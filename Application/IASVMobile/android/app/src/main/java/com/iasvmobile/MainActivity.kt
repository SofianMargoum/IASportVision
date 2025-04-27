package com.iasvmobile

import android.os.Bundle
import android.view.View
import android.content.SharedPreferences
import android.view.WindowInsets
import android.view.WindowInsetsController
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "IASVMobile"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        updateNavigationBar()
    }

    override fun onResume() {
        super.onResume()
        updateNavigationBar()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            updateNavigationBar()
        }
    }

    // Vérifie si l'utilisateur a activé le mode plein écran dans React Native
    private fun isFullScreenActive(): Boolean {
        val prefs: SharedPreferences = getSharedPreferences("app_prefs", MODE_PRIVATE)
        val isFullScreen = prefs.getBoolean("is_full_screen", false)
        println("DEBUG: isFullScreenActive = $isFullScreen") // Log pour vérifier l'état
        return isFullScreen
    }

    // Met à jour la barre de navigation en fonction du mode plein écran
    private fun updateNavigationBar() {
        if (isFullScreenActive()) {
            hideNavigationBar()
        } else {
            showNavigationBar()
        }
    }

    // Masque la barre de navigation avec WindowInsetsController (Android 11+) ou avec les flags legacy
    private fun hideNavigationBar() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.navigationBars() or WindowInsets.Type.statusBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    // Affiche la barre de navigation (au cas où le mode plein écran est désactivé)
    private fun showNavigationBar() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.show(WindowInsets.Type.navigationBars() or WindowInsets.Type.statusBars())
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        }
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
