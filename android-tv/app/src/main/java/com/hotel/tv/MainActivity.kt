package com.hotel.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

/**
 * URL de la pantalla TV. Cámbiala por la de tu servidor:
 *  - Emulador de Android: http://10.0.2.2:3000/tv/
 *  - TV real en tu red:  http://192.168.X.X:3000/tv/
 *  - Producción (HTTPS): https://tu-dominio.com/tv/
 */
private const val TV_URL = "https://channel-manager-0z3d.onrender.com/tv/"

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var customView: View? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) { callback?.onCustomViewHidden(); return }
                customView = view
                (window.decorView as FrameLayout).addView(
                    view,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                )
                window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            }

            override fun onHideCustomView() {
                if (customView == null) return
                (window.decorView as FrameLayout).removeView(customView)
                customView = null
                window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
                setContentView(webView)
            }
        }

        webView.loadUrl(TV_URL)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        // Botón Atrás: cierra el reproductor si está abierto; la app nunca sale (modo kiosco).
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            webView.evaluateJavascript("window.__closePlayer && window.__closePlayer();", null)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
