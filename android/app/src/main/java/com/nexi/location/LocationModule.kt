package com.nexi.location

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LocationModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LocationModule"

    @ReactMethod
    fun startLocationSharing(objectId: String, serverUrl: String, appId: String, masterKey: String, promise: Promise) {
        try {
            // Permission sanity check; JS should request, this is just a guard
            val hasFine = reactContext.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val hasCoarse = reactContext.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val hasBg = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                reactContext.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
            } else true
            if (!(hasFine || hasCoarse) || !hasBg) {
                promise.reject("E_PERM", "Missing location permissions")
                return
            }

            val intent = Intent(reactContext, LocationForegroundService::class.java).apply {
                putExtra(LocationForegroundService.EXTRA_OBJECT_ID, objectId)
                putExtra(LocationForegroundService.EXTRA_SERVER_URL, serverUrl)
                putExtra(LocationForegroundService.EXTRA_APP_ID, appId)
                putExtra(LocationForegroundService.EXTRA_MASTER_KEY, masterKey)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("E_START", t)
        }
    }

    @ReactMethod
    fun stopLocationSharing(promise: Promise) {
        try {
            val intent = Intent(reactContext, LocationForegroundService::class.java)
            reactContext.stopService(intent)
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("E_STOP", t)
        }
    }
}


