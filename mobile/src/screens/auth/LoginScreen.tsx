import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../api/client';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/spacing';

interface OtpChallenge {
  challengeId: string;
  maskedEmail: string;
  expiresInSec: number;
  resendAfterSec: number;
}

const formatCountdown = (sec: number): string => {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    providers,
    fetchProviders,
    initiateOtpLogin,
    verifyOtp,
    resendOtp,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [expiresRemaining, setExpiresRemaining] = useState(180);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resending, setResending] = useState(false);

  // Password reset state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetChallengeId, setResetChallengeId] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (!challenge) return;
    setExpiresRemaining(challenge.expiresInSec);
    setResendCooldown(challenge.resendAfterSec);

    const timer = setInterval(() => {
      setExpiresRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  const handleGoogleLogin = async () => {
    setError(null);
    setNotice(null);
    const activeProviders = providers || (await fetchProviders());

    if (!activeProviders?.google?.redirectFlowEnabled && !activeProviders?.google?.idTokenEnabled) {
      setError(
        'Google OAuth is not configured on the backend yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env.'
      );
      return;
    }

    const baseUrl = apiClient.defaults.baseURL || 'http://10.0.2.2:3001';
    try {
      const res = await fetch(`${baseUrl}/api/auth/google/start`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message || 'Google sign-in is unavailable.');
        return;
      }
      const json = (await res.json()) as { success?: boolean; authUrl?: string; message?: string };
      if (json.success && json.authUrl) {
        await Linking.openURL(json.authUrl);
      } else {
        setError(json.message || 'Unable to start Google OAuth flow.');
      }
    } catch {
      setError('Cannot reach SyncWave server for Google OAuth.');
    }
  };

  const handleCredentialsSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);
    const res = await initiateOtpLogin(trimmedEmail, password);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Authentication failed.');
      return;
    }

    if (res.otpRequired && res.challengeId) {
      setOtpCode('');
      setChallenge({
        challengeId: res.challengeId,
        maskedEmail: res.maskedEmail || trimmedEmail,
        expiresInSec: res.expiresInSec ?? 180,
        resendAfterSec: res.resendAfterSec ?? 30,
      });
      return;
    }

    navigation.goBack();
  };

  const handleVerifyOtp = async () => {
    if (!challenge) return;
    const cleaned = otpCode.replace(/\D/g, '');
    if (cleaned.length !== 6) {
      setError('Enter the complete 6-digit verification code.');
      return;
    }
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const res = await verifyOtp(challenge.challengeId, email.trim(), cleaned);
    setSubmitting(false);

    if (!res.ok) {
      setError(
        res.attemptsRemaining !== undefined
          ? `${res.error || 'Invalid OTP'} (${res.attemptsRemaining} attempts left)`
          : res.error || 'Invalid OTP code.'
      );
      return;
    }

    navigation.goBack();
  };

  const handleResendOtp = async () => {
    if (!challenge || resending || resendCooldown > 0) return;
    setError(null);
    setNotice(null);
    setResending(true);
    const res = await resendOtp(challenge.challengeId, email.trim());
    setResending(false);

    if (res.ok) {
      setResendCooldown(res.resendAfterSec ?? 30);
      setExpiresRemaining(challenge.expiresInSec);
      setNotice(`Sent a new 6-digit verification code to ${challenge.maskedEmail}.`);
    } else {
      if (typeof res.retryAfterSec === 'number') {
        setResendCooldown(res.retryAfterSec);
      }
      setError(res.error || 'Failed to resend code.');
    }
  };

  const handleRequestResetSubmit = async () => {
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setNotice(null);
    setResetSubmitting(true);
    const res = await requestPasswordReset(trimmed);
    setResetSubmitting(false);

    if (res.ok && res.challengeId) {
      setResetChallengeId(res.challengeId);
      setResetStep('confirm');
      setNotice(`Reset code sent to ${res.maskedEmail || trimmed}`);
    } else {
      setError(res.error || 'Failed to send reset code.');
    }
  };

  const handleConfirmResetSubmit = async () => {
    const cleanedOtp = resetOtp.replace(/\D/g, '');
    if (cleanedOtp.length !== 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    if (resetNewPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError(null);
    setNotice(null);
    setResetSubmitting(true);
    const res = await confirmPasswordReset({
      email: resetEmail.trim(),
      challengeId: resetChallengeId,
      otp: cleanedOtp,
      newPassword: resetNewPassword,
    });
    setResetSubmitting(false);

    if (res.ok) {
      setShowForgotPassword(false);
      setEmail(resetEmail.trim());
      setPassword('');
      setResetStep('request');
      setResetOtp('');
      setResetNewPassword('');
      setNotice('Password reset successful! Please sign in with your new password.');
    } else {
      setError(res.error || 'Failed to reset password.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {showForgotPassword ? (
              <View style={styles.sectionGap}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.title}>Reset Password</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForgotPassword(false);
                      setResetStep('request');
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    <Text style={styles.linkAccent}>Back to sign in</Text>
                  </TouchableOpacity>
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {notice ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>{notice}</Text>
                  </View>
                ) : null}

                {resetStep === 'request' ? (
                  <>
                    <Text style={styles.subtitle}>
                      Enter your account email to receive a 6-digit password reset code.
                    </Text>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Email address</Text>
                      <TextInput
                        value={resetEmail}
                        onChangeText={setResetEmail}
                        placeholder="you@example.com"
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, resetSubmitting && styles.disabledBtn]}
                      onPress={handleRequestResetSubmit}
                      disabled={resetSubmitting}
                    >
                      {resetSubmitting ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.subtitle}>
                      Enter the 6-digit OTP code sent to your email and set a new password.
                    </Text>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>6-Digit OTP</Text>
                      <TextInput
                        value={resetOtp}
                        onChangeText={(t) => setResetOtp(t.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={6}
                        style={styles.otpInput}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>New Password (min 6 characters)</Text>
                      <TextInput
                        value={resetNewPassword}
                        onChangeText={setResetNewPassword}
                        placeholder="Enter new password"
                        placeholderTextColor={Colors.textTertiary}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        style={styles.input}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, resetSubmitting && styles.disabledBtn]}
                      onPress={handleConfirmResetSubmit}
                      disabled={resetSubmitting}
                    >
                      {resetSubmitting ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Update Password & Sign In</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : challenge ? (
              <View style={styles.sectionGap}>
                <Text style={styles.title}>Enter 6-digit OTP</Text>
                <Text style={styles.subtitle}>
                  Sent to {challenge.maskedEmail}. Expires in{' '}
                  <Text style={styles.monoHighlight}>{formatCountdown(expiresRemaining)}</Text>
                </Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {notice ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>{notice}</Text>
                  </View>
                ) : null}

                <TextInput
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={styles.otpInput}
                  textContentType="oneTimeCode"
                />

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (submitting || otpCode.length !== 6 || expiresRemaining <= 0) && styles.disabledBtn,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={submitting || otpCode.length !== 6 || expiresRemaining <= 0}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.rowBetween}>
                  <TouchableOpacity
                    onPress={() => {
                      setChallenge(null);
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    <Text style={styles.linkMuted}>Edit email / password</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={resending || resendCooldown > 0}
                  >
                    <Text
                      style={[
                        styles.linkAccent,
                        (resending || resendCooldown > 0) && { color: Colors.textTertiary },
                      ]}
                    >
                      {resending
                        ? 'Sending...'
                        : resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.sectionGap}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>
                  Continue with Google or sign in with email, password &amp; 6-digit OTP.
                </Text>

                <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
                  <Text style={styles.googleBadge}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR EMAIL + OTP</Text>
                  <View style={styles.dividerLine} />
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email address</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Password</Text>
                    <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                      <Text style={styles.linkAccent}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setShowForgotPassword(true);
                      setResetEmail(email.trim());
                      setResetStep('request');
                      setError(null);
                      setNotice(null);
                    }}
                    style={{ alignSelf: 'flex-end', marginTop: 6 }}
                  >
                    <Text style={[styles.linkAccent, { fontSize: 12 }]}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusLabel}>Email OTP Delivery</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      { color: providers?.otp?.enabled ? Colors.success : Colors.accent },
                    ]}
                  >
                    {providers
                      ? providers.otp.enabled
                        ? `Active (${providers.otp.provider})`
                        : 'Configure SMTP / Resend'
                      : 'Checking...'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, submitting && styles.disabledBtn]}
                  onPress={handleCredentialsSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue with OTP</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to SyncWave? </Text>
            <TouchableOpacity onPress={() => navigation.replace('SignUp')}>
              <Text style={styles.linkAccent}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  content: { padding: Spacing.md, paddingTop: Spacing.lg },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.md,
  },
  sectionGap: { gap: Spacing.md },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '600' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  monoHighlight: { color: Colors.accent, fontWeight: '600' },
  googleButton: {
    height: 46,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleBadge: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  googleButtonText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.hairline },
  dividerText: { color: Colors.textTertiary, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  fieldGroup: { gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  input: {
    height: 44,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  otpInput: {
    height: 52,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.tag,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusLabel: { color: Colors.textTertiary, fontSize: 11 },
  statusValue: { fontSize: 11, fontWeight: '600' },
  primaryButton: {
    height: 46,
    borderRadius: Radius.control,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.5 },
  primaryButtonText: { color: '#000', fontSize: 14, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    padding: 10,
  },
  errorText: { color: '#FCA5A5', fontSize: 12, lineHeight: 17 },
  noticeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    padding: 10,
  },
  noticeText: { color: '#6EE7B7', fontSize: 12, lineHeight: 17 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkMuted: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  linkAccent: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  footerText: { color: Colors.textTertiary, fontSize: 13 },
});
