package com.syncwave.music.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.remote.AuthProvidersDto
import com.syncwave.music.data.remote.GoogleIdTokenRequest
import com.syncwave.music.data.remote.LoginRequest
import com.syncwave.music.data.remote.OtpResendRequest
import com.syncwave.music.data.remote.OtpVerifyRequest
import com.syncwave.music.data.remote.RegisterRequest
import com.syncwave.music.data.remote.SyncWaveApiService
import com.syncwave.music.data.remote.UserDto
import com.syncwave.music.data.repository.PreferencesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val errorCode: String? = null,
    val statusMessage: String? = null,
    val isAuthenticated: Boolean = false,
    val userEmail: String? = null,
    val userName: String? = null,
    val authProvider: String? = null,
    val providers: AuthProvidersDto? = null,
    val challengeId: String? = null,
    val maskedEmail: String? = null,
    val pendingEmail: String = "",
    val expiresRemainingSec: Int = 0,
    val resendCooldownSec: Int = 0,
    val authSuccessCompleted: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val apiService: SyncWaveApiService,
    private val preferencesRepository: PreferencesRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private var countdownJob: Job? = null

    init {
        observeStoredSession()
        fetchProviders()
    }

    private fun observeStoredSession() {
        viewModelScope.launch {
            combine(
                preferencesRepository.authToken,
                preferencesRepository.authUserEmail,
                preferencesRepository.authUserName,
                preferencesRepository.authProvider
            ) { token, email, name, provider ->
                arrayOf(token, email, name, provider)
            }.collect { values ->
                val token = values[0]
                _uiState.update {
                    it.copy(
                        isAuthenticated = !token.isNullOrBlank(),
                        userEmail = values[1],
                        userName = values[2],
                        authProvider = values[3]
                    )
                }
            }
        }
    }

    fun fetchProviders() {
        viewModelScope.launch {
            try {
                val res = apiService.getAuthProviders()
                val body = res.body()
                if (res.isSuccessful && body?.success == true) {
                    _uiState.update {
                        it.copy(
                            providers = AuthProvidersDto(
                                google = body.google,
                                otp = body.otp
                            )
                        )
                    }
                }
            } catch (_: Exception) {
                // Keep defaults cleanly if server unreachable
            }
        }
    }

    fun clearErrorsAndNotices() {
        _uiState.update { it.copy(errorMessage = null, errorCode = null, statusMessage = null) }
    }

    fun resetChallenge() {
        countdownJob?.cancel()
        _uiState.update {
            it.copy(
                challengeId = null,
                maskedEmail = null,
                expiresRemainingSec = 0,
                resendCooldownSec = 0,
                errorMessage = null,
                errorCode = null,
                statusMessage = null
            )
        }
    }

    fun consumeAuthCompletedEvent() {
        _uiState.update { it.copy(authSuccessCompleted = false) }
    }

    fun initiateOtpLogin(email: String, password: String) {
        val cleanEmail = email.trim()
        if (cleanEmail.isEmpty() || password.isEmpty()) {
            _uiState.update { it.copy(errorMessage = "Email and password are required.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, errorCode = null, statusMessage = null) }
            try {
                val res = apiService.initiateOtpLogin(LoginRequest(cleanEmail, password))
                val body = res.body()
                if (res.isSuccessful && body?.success == true) {
                    if (body.otpRequired && !body.challengeId.isNullOrBlank()) {
                        startChallengeCountdown(
                            challengeId = body.challengeId,
                            maskedEmail = body.maskedEmail ?: cleanEmail,
                            pendingEmail = cleanEmail,
                            expiresInSec = body.expiresInSec ?: 180,
                            resendAfterSec = body.resendAfterSec ?: 30
                        )
                    } else if (!body.token.isNullOrBlank() && body.user != null) {
                        saveUserSession(body.token, body.user)
                    }
                } else {
                    val (msg, code) = parseError(res.errorBody()?.string(), body?.message ?: "Authentication failed.")
                    _uiState.update { it.copy(isLoading = false, errorMessage = msg, errorCode = code) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Unable to connect to SyncWave server."
                    )
                }
            }
        }
    }

    fun registerAccount(
        email: String,
        password: String,
        displayName: String,
        verifyWithOtp: Boolean
    ) {
        val cleanEmail = email.trim()
        val cleanName = displayName.trim()
        if (cleanName.length < 2) {
            _uiState.update { it.copy(errorMessage = "Display name must be at least 2 characters.") }
            return
        }
        if (password.length < 8) {
            _uiState.update { it.copy(errorMessage = "Password must be at least 8 characters long.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, errorCode = null, statusMessage = null) }
            try {
                val res = apiService.registerAccount(
                    RegisterRequest(
                        email = cleanEmail,
                        password = password,
                        displayName = cleanName,
                        verifyWithOtp = verifyWithOtp
                    )
                )
                val body = res.body()
                if (res.isSuccessful && body?.success == true) {
                    if (body.otpRequired && !body.challengeId.isNullOrBlank()) {
                        startChallengeCountdown(
                            challengeId = body.challengeId,
                            maskedEmail = body.maskedEmail ?: cleanEmail,
                            pendingEmail = cleanEmail,
                            expiresInSec = body.expiresInSec ?: 180,
                            resendAfterSec = body.resendAfterSec ?: 30
                        )
                    } else if (!body.token.isNullOrBlank() && body.user != null) {
                        saveUserSession(body.token, body.user)
                    }
                } else {
                    val (msg, code) = parseError(res.errorBody()?.string(), body?.message ?: "Registration failed.")
                    _uiState.update { it.copy(isLoading = false, errorMessage = msg, errorCode = code) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Unable to connect to SyncWave server."
                    )
                }
            }
        }
    }

    fun verifyOtp(otp: String) {
        val state = _uiState.value
        val challengeId = state.challengeId ?: return
        val cleanOtp = otp.filter { it.isDigit() }
        if (cleanOtp.length != 6) {
            _uiState.update { it.copy(errorMessage = "Enter the full 6-digit verification code.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, statusMessage = null) }
            try {
                val res = apiService.verifyOtp(
                    OtpVerifyRequest(
                        challengeId = challengeId,
                        email = state.pendingEmail,
                        otp = cleanOtp
                    )
                )
                val body = res.body()
                if (res.isSuccessful && body?.success == true && !body.token.isNullOrBlank() && body.user != null) {
                    saveUserSession(body.token, body.user)
                } else {
                    val (msg, code) = parseError(res.errorBody()?.string(), body?.message ?: "Invalid OTP code.")
                    _uiState.update { it.copy(isLoading = false, errorMessage = msg, errorCode = code) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Could not verify OTP."
                    )
                }
            }
        }
    }

    fun resendOtp() {
        val state = _uiState.value
        val challengeId = state.challengeId ?: return
        if (state.resendCooldownSec > 0) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, statusMessage = null) }
            try {
                val res = apiService.resendOtp(
                    OtpResendRequest(challengeId = challengeId, email = state.pendingEmail)
                )
                val body = res.body()
                if (res.isSuccessful && body?.success == true) {
                    val nextCooldown = body.resendAfterSec ?: 30
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            resendCooldownSec = nextCooldown,
                            expiresRemainingSec = 600,
                            statusMessage = "A fresh 6-digit OTP was sent to ${state.maskedEmail}."
                        )
                    }
                } else {
                    val (msg, code) = parseError(res.errorBody()?.string(), body?.message ?: "Could not resend OTP.")
                    _uiState.update { it.copy(isLoading = false, errorMessage = msg, errorCode = code) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Network error while resending OTP."
                    )
                }
            }
        }
    }

    fun startGoogleOAuth(onLaunchUrl: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, errorCode = null) }
            try {
                val res = apiService.startGoogleOAuth()
                val body = res.body()
                if (res.isSuccessful && body?.success == true && !body.authUrl.isNullOrBlank()) {
                    _uiState.update { it.copy(isLoading = false) }
                    onLaunchUrl(body.authUrl)
                } else {
                    val (msg, code) = parseError(
                        res.errorBody()?.string(),
                        body?.message ?: "Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env."
                    )
                    _uiState.update { it.copy(isLoading = false, errorMessage = msg, errorCode = code) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Unable to connect to SyncWave server for Google OAuth."
                    )
                }
            }
        }
    }

    fun submitGoogleIdToken(idToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val res = apiService.loginWithGoogle(GoogleIdTokenRequest(idToken))
                val body = res.body()
                if (res.isSuccessful && body?.success == true && !body.token.isNullOrBlank() && body.user != null) {
                    saveUserSession(body.token, body.user)
                } else {
                    val (msg, code) = parseError(res.errorBody()?.string(), body?.message ?: "Google authentication failed.")
                    _uiState.update { it.copy(isLoading = false, errorMessage = msg, errorCode = code) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = e.localizedMessage ?: "Google login request failed.")
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            preferencesRepository.clearAuthSession()
        }
    }

    private suspend fun saveUserSession(token: String, user: UserDto) {
        countdownJob?.cancel()
        preferencesRepository.saveAuthSession(
            token = token,
            userId = user.id,
            email = user.email,
            displayName = user.displayName,
            provider = user.authProvider ?: "EMAIL"
        )
        _uiState.update {
            it.copy(
                isLoading = false,
                challengeId = null,
                maskedEmail = null,
                expiresRemainingSec = 0,
                resendCooldownSec = 0,
                authSuccessCompleted = true,
                errorMessage = null,
                errorCode = null
            )
        }
    }

    private fun startChallengeCountdown(
        challengeId: String,
        maskedEmail: String,
        pendingEmail: String,
        expiresInSec: Int,
        resendAfterSec: Int
    ) {
        countdownJob?.cancel()
        _uiState.update {
            it.copy(
                isLoading = false,
                challengeId = challengeId,
                maskedEmail = maskedEmail,
                pendingEmail = pendingEmail,
                expiresRemainingSec = expiresInSec,
                resendCooldownSec = resendAfterSec,
                errorMessage = null,
                errorCode = null
            )
        }

        countdownJob = viewModelScope.launch {
            while (isActive) {
                delay(1000L)
                var expired = false
                _uiState.update { current ->
                    val nextExp = (current.expiresRemainingSec - 1).coerceAtLeast(0)
                    val nextResend = (current.resendCooldownSec - 1).coerceAtLeast(0)
                    expired = nextExp == 0 && nextResend == 0
                    current.copy(expiresRemainingSec = nextExp, resendCooldownSec = nextResend)
                }
                if (expired) break
            }
        }
    }

    private fun parseError(rawErrorBody: String?, fallback: String): Pair<String, String?> {
        if (rawErrorBody.isNullOrBlank()) return fallback to null
        return try {
            val json = JSONObject(rawErrorBody)
            val msg = json.optString("message").ifBlank { fallback }
            val code = json.optString("code").ifBlank { null }
            val attempts = if (json.has("attemptsRemaining")) {
                " (${json.optInt("attemptsRemaining")} attempts left)"
            } else {
                ""
            }
            "$msg$attempts" to code
        } catch (_: Exception) {
            fallback to null
        }
    }

    override fun onCleared() {
        super.onCleared()
        countdownJob?.cancel()
    }
}
