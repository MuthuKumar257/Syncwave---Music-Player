package com.syncwave.music.ui.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.syncwave.music.ui.theme.AccentAmber
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.ErrorRed
import com.syncwave.music.ui.theme.HairlineLight
import com.syncwave.music.ui.theme.SuccessGreen
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.SurfaceRaisedDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import com.syncwave.music.ui.theme.TextTertiaryDark

@Composable
fun LoginScreen(
    onBack: () -> Unit,
    onNavigateToSignUp: () -> Unit,
    onAuthSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var otpCode by remember { mutableStateOf("") }

    LaunchedEffect(uiState.authSuccessCompleted) {
        if (uiState.authSuccessCompleted) {
            viewModel.consumeAuthCompletedEvent()
            onAuthSuccess()
        }
    }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = AccentAmber,
        unfocusedBorderColor = HairlineLight,
        focusedTextColor = TextPrimaryDark,
        unfocusedTextColor = TextPrimaryDark,
        cursorColor = AccentAmber,
        focusedContainerColor = SurfaceRaisedDark,
        unfocusedContainerColor = SurfaceRaisedDark,
        focusedLabelColor = AccentAmber,
        unfocusedLabelColor = TextSecondaryDark
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = TextPrimaryDark
                )
            }
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "Sign In",
                color = TextPrimaryDark,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(SurfaceDark)
                .padding(20.dp)
        ) {
            if (uiState.challengeId != null) {
                Text(
                    text = "Two-step OTP Verification",
                    color = TextPrimaryDark,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                val mins = uiState.expiresRemainingSec / 60
                val secs = uiState.expiresRemainingSec % 60
                Text(
                    text = "Enter the 6-digit code sent to ${uiState.maskedEmail ?: email}. Expires in %02d:%02d".format(mins, secs),
                    color = TextSecondaryDark,
                    fontSize = 13.sp
                )

                Spacer(modifier = Modifier.height(16.dp))

                AuthBanner(errorMessage = uiState.errorMessage, statusMessage = uiState.statusMessage)

                OutlinedTextField(
                    value = otpCode,
                    onValueChange = { next -> otpCode = next.filter { it.isDigit() }.take(6) },
                    label = { Text("6-digit verification code") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = { viewModel.verifyOtp(otpCode) },
                    enabled = !uiState.isLoading && otpCode.length == 6 && uiState.expiresRemainingSec > 0,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentAmber, contentColor = Color.Black),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                    } else {
                        Text("Verify & Sign In", fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TextButton(onClick = { viewModel.resetChallenge() }) {
                        Text("Edit credentials", color = TextSecondaryDark, fontSize = 12.sp)
                    }
                    TextButton(
                        onClick = { viewModel.resendOtp() },
                        enabled = !uiState.isLoading && uiState.resendCooldownSec == 0
                    ) {
                        Text(
                            text = if (uiState.resendCooldownSec > 0) {
                                "Resend in ${uiState.resendCooldownSec}s"
                            } else {
                                "Resend OTP"
                            },
                            color = if (uiState.resendCooldownSec > 0) TextTertiaryDark else AccentAmber,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            } else {
                Text(
                    text = "Welcome back",
                    color = TextPrimaryDark,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Continue with Google or verify via email, password & 6-digit OTP.",
                    color = TextSecondaryDark,
                    fontSize = 13.sp
                )

                Spacer(modifier = Modifier.height(18.dp))

                OutlinedButton(
                    onClick = {
                        viewModel.startGoogleOAuth { authUrl ->
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(authUrl)))
                        }
                    },
                    enabled = !uiState.isLoading,
                    border = BorderStroke(1.dp, HairlineLight),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp)
                ) {
                    Text("G", color = AccentAmber, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Continue with Google", color = TextPrimaryDark, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    HorizontalDivider(modifier = Modifier.weight(1f), color = HairlineLight)
                    Text(
                        text = " OR EMAIL + OTP ",
                        color = TextTertiaryDark,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    HorizontalDivider(modifier = Modifier.weight(1f), color = HairlineLight)
                }

                Spacer(modifier = Modifier.height(16.dp))

                AuthBanner(errorMessage = uiState.errorMessage, statusMessage = uiState.statusMessage)

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email address") },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = TextTertiaryDark) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextTertiaryDark) },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (showPassword) "Hide password" else "Show password",
                                tint = TextSecondaryDark
                            )
                        }
                    },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                val otpEnabled = uiState.providers?.otp?.enabled == true
                val otpProviderLabel = uiState.providers?.otp?.provider ?: "CHECKING"
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceRaisedDark)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Email OTP delivery", color = TextSecondaryDark, fontSize = 11.sp)
                    Text(
                        text = if (otpEnabled) "Active ($otpProviderLabel)" else "Configure SMTP / Resend",
                        color = if (otpEnabled) SuccessGreen else AccentAmber,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = { viewModel.initiateOtpLogin(email, password) },
                    enabled = !uiState.isLoading,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentAmber, contentColor = Color.Black),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                    } else {
                        Text("Continue with OTP", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("New to SyncWave?", color = TextSecondaryDark, fontSize = 13.sp)
            TextButton(onClick = onNavigateToSignUp) {
                Text("Create an account", color = AccentAmber, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
internal fun AuthBanner(errorMessage: String?, statusMessage: String?) {
    if (!errorMessage.isNullOrBlank()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(ErrorRed.copy(alpha = 0.14f))
                .padding(12.dp)
        ) {
            Text(text = errorMessage, color = Color(0xFFFCA5A5), fontSize = 12.sp, textAlign = TextAlign.Start)
        }
    } else if (!statusMessage.isNullOrBlank()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(SuccessGreen.copy(alpha = 0.14f))
                .padding(12.dp)
        ) {
            Text(text = statusMessage, color = Color(0xFF6EE7B7), fontSize = 12.sp)
        }
    }
}
