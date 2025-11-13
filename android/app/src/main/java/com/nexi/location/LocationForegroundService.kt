package com.nexi.location

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.nexi.MainActivity
import com.google.android.gms.location.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

class LocationForegroundService : Service() {

    private lateinit var fusedClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null

    private val serviceScope = CoroutineScope(Dispatchers.IO)
    private var updateJob: Job? = null

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val objectId = intent?.getStringExtra(EXTRA_OBJECT_ID) ?: return START_NOT_STICKY
        val serverUrl = intent.getStringExtra(EXTRA_SERVER_URL) ?: return START_NOT_STICKY
        val appId = intent.getStringExtra(EXTRA_APP_ID) ?: return START_NOT_STICKY
        val masterKey = intent.getStringExtra(EXTRA_MASTER_KEY) ?: return START_NOT_STICKY

        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        startLocationUpdates(objectId, serverUrl, appId, masterKey)
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopLocationUpdates()
    }

    private fun startLocationUpdates(
        objectId: String,
        serverUrl: String,
        appId: String,
        masterKey: String
    ) {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
            .setMinUpdateIntervalMillis(10_000L)
            .setWaitForAccurateLocation(false)
            .build()

        locationCallback = object : LocationCallback() {
            private var lastSentMs: Long = 0L

            override fun onLocationResult(result: LocationResult) {
                val location: Location = result.lastLocation ?: return
                val now = System.currentTimeMillis()
                if (now - lastSentMs >= 9_500L) { // throttle ~10s
                    lastSentMs = now
                    sendUpdate(objectId, serverUrl, appId, masterKey, location)
                }
            }
        }

        try {
            fusedClient.requestLocationUpdates(
                request,
                locationCallback as LocationCallback,
                mainLooper
            )
        } catch (_: SecurityException) {
            // Missing permission; stop service silently
            stopSelf()
        }

        // Safety: also poll last known every 10s in case callbacks stall
        updateJob?.cancel()
        updateJob = serviceScope.launch {
            while (true) {
                try {
                    val last = fusedClient.awaitSafe()
                    if (last != null) {
                        sendUpdate(objectId, serverUrl, appId, masterKey, last)
                    }
                } catch (_: SecurityException) {
                    stopSelf()
                    return@launch
                } catch (_: Throwable) { }
                kotlinx.coroutines.delay(10_000L)
            }
        }
    }

    private fun stopLocationUpdates() {
        locationCallback?.let { fusedClient.removeLocationUpdates(it) }
        locationCallback = null
        updateJob?.cancel()
        updateJob = null
    }

    private fun sendUpdate(
        objectId: String,
        serverUrl: String,
        appId: String,
        masterKey: String,
        location: Location
    ) {
        serviceScope.launch {
            try {
                val bodyJson = JSONObject().apply {
                    put("location", JSONObject().apply {
                        put("__type", "GeoPoint")
                        put("latitude", location.latitude)
                        put("longitude", location.longitude)
                    })
                    put("isOnline", true)
                }

                val media = "application/json".toMediaType()
                val requestBody = RequestBody.create(media, bodyJson.toString())
                val request = Request.Builder()
                    .url("$serverUrl/classes/UserProfile/$objectId")
                    .put(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("X-Parse-Application-Id", appId)
                    .addHeader("X-Parse-Master-Key", masterKey)
                    .build()

                httpClient.newCall(request).execute().use { /* ignore response */ }
            } catch (_: Throwable) {
                // swallow; next tick will retry
            }
        }
    }

    private fun buildNotification(): Notification {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nexi is sharing your location")
            .setContentText("Location updates are running every 10 seconds")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Updates",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.description = "Foreground service for background location updates"
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "nexi_location_channel"
        const val NOTIFICATION_ID = 1001

        const val EXTRA_OBJECT_ID = "object_id"
        const val EXTRA_SERVER_URL = "server_url"
        const val EXTRA_APP_ID = "app_id"
        const val EXTRA_MASTER_KEY = "master_key"
    }
}

// Simple await for lastLocation Task without bringing in full ktx dependency
private suspend fun FusedLocationProviderClient.lastLocationAwait(): Location? =
    suspendCancellableCoroutine { cont ->
        lastLocation
            .addOnSuccessListener { cont.resume(it) }
            .addOnFailureListener { cont.resume(null) }
    }

private suspend fun FusedLocationProviderClient.awaitSafe(): Location? = try {
    lastLocationAwait()
} catch (_: Throwable) { null }


