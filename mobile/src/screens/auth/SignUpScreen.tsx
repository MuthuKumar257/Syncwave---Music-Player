import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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

export const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providers, fetchProviders, registerAccount, verifyOtp, resendOtp } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifyWithOtp, setVerifyWithOtp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (providers) {
      setVerifyWithOtp(providers.otp.enabled);
    }
  }, [providers]);

  useEffect(() => {
    if (!challenge) return;
    setResendCooldown(challenge.resendAfterSec);
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  const strengthScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9\W]/.test(password)) score += 1;
    return score;
  }, [password]);

  const handleGoogleSignUp = async () => {
    setError(null);
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
      const json = (await res.json()) as { success?: boolean; authUrl?: string; message?: string };
      if (res.ok && json.success && json.authUrl) {
        await Linking.openURL(json.authUrl);
      } else {
        setError(json.message || 'Unable to start Google sign-up.');
      }
    } catch {
      setError('Cannot reach SyncWave server for Google OAuth.');
    }
  };

  const handleRegister = async () => {
    setError(null);
    setNotice(null);

    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    if (!email.trim().includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const res = await registerAccount(email.trim(), password, displayName.trim(), verifyWithOtp);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not create account.');
      if (res.code === 'OTP_SEND_FAILED' || res.code === 'OTP_DELIVERY_NOT_CONFIGURED') {
        setVerifyWithOtp(false);
        setNotice('Email OTP delivery failed. OTP verification has been disabled so you can tap Create Account to register directly.');
      }
      return;
    }

    if (res.otpRequired && res.challengeId) {
      setOtpCode('');
      setChallenge({
        challengeId: res.challengeId,
        maskedEmail: res.maskedEmail || email.trim(),
        expiresInSec: res.expiresInSec ?? 180,
        resendAfterSec: res.resendAfterSec ?? 30,
      });
      return;
    }

    navigation.navigate('LanguageSelection');
  };

  const handleVerifyOtp = async () => {
    if (!challenge) return;
    const cleaned = otpCode.replace(/\D/g, '');
    if (cleaned.length !== 6) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const res = await verifyOtp(challenge.challengeId, email.trim(), cleaned);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Invalid OTP code.');
      return;
    }

    navigation.navigate('LanguageSelection');
  };

  const handleResend = async () => {
    if (!challenge || resending || resendCooldown > 0) return;
    setError(null);
    setNotice(null);
    setResending(true);
    const res = await resendOtp(challenge.challengeId, email.trim());
    setResending(false);

    if (res.ok) {
      setResendCooldown(res.resendAfterSec ?? 30);
      setNotice(`Fresh verification code sent to ${challenge.maskedEmail}.`);
    } else {
      if (typeof res.retryAfterSec === 'number') setResendCooldown(res.retryAfterSec);
      setError(res.error || 'Failed to resend verification code.');
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
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {challenge ? (
              <View style={styles.sectionGap}>
                <Text style={styles.title}>Verify your email</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit security code sent to {challenge.maskedEmail}.
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
                  style={[styles.primaryButton, (submitting || otpCode.length !== 6) && styles.disabledBtn]}
                  onPress={handleVerifyOtp}
                  disabled={submitting || otpCode.length !== 6}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Finish Sign Up</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.rowBetween}>
                  <TouchableOpacity onPress={() => setChallenge(null)}>
                    <Text style={styles.linkMuted}>Back to registration</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleResend} disabled={resending || resendCooldown > 0}>
                    <Text
                      style={[
                        styles.linkAccent,
                        (resending || resendCooldown > 0) && { color: Colors.textTertiary },
                      ]}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.sectionGap}>
                <Text style={styles.title}>Join SyncWave</Text>
                <Text style={styles.subtitle}>
                  Sync your playlists, smart schedules &amp; listening profile across devices.
                </Text>

                <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignUp}>
                  <Text style={styles.googleBadge}>G</Text>
                  <Text style={styles.googleButtonText}>Sign up with Google</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR REGISTER WITH EMAIL</Text>
                  <View style={styles.dividerLine} />
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Display name</Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                  />
                </View>

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
                    <Text style={styles.label}>Password (min 8 chars)</Text>
                    <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                      <Text style={styles.linkAccent}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Create a strong password"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  {password.length > 0 ? (
                    <View style={styles.strengthRow}>
                      {[1, 2, 3, 4].map((step) => (
                        <View
                          key={step}
                          style={[
                            styles.strengthBar,
                            {
                              backgroundColor:
                                strengthScore >= step
                                  ? strengthScore <= 2
                                    ? Colors.error
                                    : strengthScore === 3
                                      ? Colors.accent
                                      : Colors.success
                                  : Colors.surfaceHover,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                <View style={styles.otpSwitchRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.switchTitle}>Verify email with 6-digit OTP</Text>
                    <Text style={styles.switchSubtitle}>
                      {providers && !providers.otp.enabled
                        ? 'Requires SMTP / Resend configuration in server/.env'
                        : 'Sends a confirmation code before activating session'}
                    </Text>
                  </View>
                  <Switch
                    value={verifyWithOtp}
                    disabled={!providers?.otp?.enabled}
                    onValueChange={setVerifyWithOtp}
                    trackColor={{ false: Colors.surfaceHover, true: Colors.accentMuted }}
                    thumbColor={verifyWithOtp ? Colors.accent : Colors.textTertiary}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, submitting && styles.disabledBtn]}
                  onPress={handleRegister}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.linkAccent}>Sign in</Text>
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
  content: { padding: Spacing.md, paddingTop: Spacing.lg, paddingBottom: 40 },
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
  googleBadge: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
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
  strengthRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: Radius.tag },
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
  otpSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 12,
  },
  switchTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  switchSubtitle: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
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
