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
import androidx.compose.material.icons.filled.Person
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
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
fun SignUpScreen(
    onBack: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onAuthSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var verifyWithOtp by remember { mutableStateOf(true) }
    var localValidationError by remember { mutableStateOf<String?>(null) }
    var otpCode by remember { mutableStateOf("") }

    LaunchedEffect(uiState.providers?.otp?.enabled) {
        uiState.providers?.let { verifyWithOtp = it.otp.enabled }
    }

    LaunchedEffect(uiState.authSuccessCompleted) {
        if (uiState.authSuccessCompleted) {
            viewModel.consumeAuthCompletedEvent()
            onAuthSuccess()
        }
    }

    val strengthScore = remember(password) {
        var score = 0
        if (password.length >= 8) score++
        if (password.any { it.isLowerCase() }) score++
        if (password.any { it.isUpperCase() }) score++
        if (password.any { !it.isLetterOrDigit() || it.isDigit() }) score++
        score
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
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimaryDark)
            }
            Spacer(modifier = Modifier.width(6.dp))
            Text("Create Account", color = TextPrimaryDark, fontSize = 20.sp, fontWeight = FontWeight.Bold)
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
                    text = "Verify your email",
                    color = TextPrimaryDark,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Enter the 6-digit security code sent to ${uiState.maskedEmail ?: email}.",
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
                    enabled = !uiState.isLoading && otpCode.length == 6,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentAmber, contentColor = Color.Black),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                    } else {
                        Text("Verify & Finish Sign Up", fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = { viewModel.resetChallenge() }) {
                        Text("Back to registration", color = TextSecondaryDark, fontSize = 12.sp)
                    }
                    TextButton(
                        onClick = { viewModel.resendOtp() },
                        enabled = !uiState.isLoading && uiState.resendCooldownSec == 0
                    ) {
                        Text(
                            text = if (uiState.resendCooldownSec > 0) "Resend in ${uiState.resendCooldownSec}s" else "Resend OTP",
                            color = if (uiState.resendCooldownSec > 0) TextTertiaryDark else AccentAmber,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            } else {
                Text("Join SyncWave", color = TextPrimaryDark, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Sync playlists, smart schedules & listening stats across Android and Web.",
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
                    Text("Sign up with Google", color = TextPrimaryDark, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    HorizontalDivider(modifier = Modifier.weight(1f), color = HairlineLight)
                    Text(" OR REGISTER WITH EMAIL ", color = TextTertiaryDark, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    HorizontalDivider(modifier = Modifier.weight(1f), color = HairlineLight)
                }

                Spacer(modifier = Modifier.height(16.dp))

                AuthBanner(
                    errorMessage = localValidationError ?: uiState.errorMessage,
                    statusMessage = uiState.statusMessage
                )

                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("Display name") },
                    leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = TextTertiaryDark) },
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(12.dp))

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
                    label = { Text("Password (min 8 chars)") },
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

                if (password.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        for (level in 1..4) {
                            val color = when {
                                strengthScore < level -> SurfaceRaisedDark
                                strengthScore <= 2 -> ErrorRed
                                strengthScore == 3 -> AccentAmber
                                else -> SuccessGreen
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(color)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Confirm password") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextTertiaryDark) },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(SurfaceRaisedDark)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                        Text("Verify email with 6-digit OTP", color = TextPrimaryDark, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text(
                            text = if (uiState.providers?.otp?.enabled == false) {
                                "Requires SMTP / Resend configuration in server/.env"
                            } else {
                                "Confirms your inbox before issuing session"
                            },
                            color = TextTertiaryDark,
                            fontSize = 11.sp
                        )
                    }
                    Switch(
                        checked = verifyWithOtp,
                        enabled = uiState.providers?.otp?.enabled != false,
                        onCheckedChange = { verifyWithOtp = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = AccentAmber, checkedTrackColor = AccentAmber.copy(alpha = 0.35f))
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = {
                        localValidationError = null
                        if (password != confirmPassword) {
                            localValidationError = "Passwords do not match."
                            return@Button
                        }
                        viewModel.registerAccount(email, password, displayName, verifyWithOtp)
                    },
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
                        Text("Create Account", fontWeight = FontWeight.Bold)
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
            Text("Already have an account?", color = TextSecondaryDark, fontSize = 13.sp)
            TextButton(onClick = onNavigateToLogin) {
                Text("Sign in", color = AccentAmber, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        }
    }
}
