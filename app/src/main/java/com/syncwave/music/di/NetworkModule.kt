package com.syncwave.music.di

import com.syncwave.music.data.remote.SyncWaveApiService
import com.syncwave.music.data.repository.PreferencesRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONObject
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val BASE_URL = "http://10.0.2.2:3001/" // Standard host loopback for Android emulator

    @Provides
    @Singleton
    fun provideOkHttpClient(preferencesRepository: PreferencesRepository): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        val refreshClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build()

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val storedToken = runBlocking { preferencesRepository.authToken.firstOrNull() }
            val reqBuilder = original.newBuilder()
            if (!storedToken.isNullOrBlank() && original.header("Authorization").isNullOrBlank()) {
                reqBuilder.header("Authorization", "Bearer $storedToken")
            }

            val firstRequest = reqBuilder.build()
            val response = chain.proceed(firstRequest)
            val path = original.url.encodedPath

            if (response.code == 401 && !storedToken.isNullOrBlank() && !path.contains("/api/auth/")) {
                val refreshReq = Request.Builder()
                    .url("${BASE_URL}api/auth/refresh")
                    .header("Authorization", "Bearer $storedToken")
                    .post("{\"token\":\"$storedToken\"}".toRequestBody("application/json".toMediaType()))
                    .build()

                try {
                    refreshClient.newCall(refreshReq).execute().use { refreshRes ->
                        val raw = refreshRes.body?.string()
                        val json = if (!raw.isNullOrBlank()) JSONObject(raw) else null
                        val freshToken = if (refreshRes.isSuccessful && json?.optBoolean("success") == true) {
                            json.optString("token").takeIf { it.isNotBlank() }
                        } else {
                            null
                        }

                        if (!freshToken.isNullOrBlank()) {
                            val userObj = json?.optJSONObject("user")
                            runBlocking {
                                preferencesRepository.saveAuthSession(
                                    token = freshToken,
                                    userId = userObj?.optString("id") ?: "",
                                    email = userObj?.optString("email") ?: "",
                                    displayName = userObj?.optString("displayName") ?: "SyncWave User",
                                    provider = userObj?.optString("authProvider") ?: "EMAIL"
                                )
                            }
                            response.close()
                            val retried = original.newBuilder()
                                .header("Authorization", "Bearer $freshToken")
                                .build()
                            return@Interceptor chain.proceed(retried)
                        } else if (refreshRes.code == 401) {
                            runBlocking { preferencesRepository.clearAuthSession() }
                        }
                    }
                } catch (_: Exception) {
                    // Keep original response if network error occurred during refresh
                }
            }
            response
        }

        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideSyncWaveApiService(retrofit: Retrofit): SyncWaveApiService {
        return retrofit.create(SyncWaveApiService::class.java)
    }
}

