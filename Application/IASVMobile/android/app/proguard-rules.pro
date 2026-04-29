# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.

# === React Native core ===
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# === Reanimated / Gesture Handler ===
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# === react-native-video / ExoPlayer ===
-keep class com.brentvatne.** { *; }
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# === react-native-vector-icons ===
-keep class com.oblador.vectoricons.** { *; }

# === AsyncStorage ===
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# === Geolocation ===
-keep class com.reactnativecommunity.geolocation.** { *; }

# === Orientation locker ===
-keep class org.wonday.orientation.** { *; }

# === Google Sign-In ===
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.android.gms.**

# === Annotations / kotlinx ===
-keepattributes *Annotation*, Signature, Exceptions, EnclosingMethod, InnerClasses
-keep class kotlin.Metadata { *; }
-dontwarn kotlinx.**

# === SVG ===
-keep public class com.horcrux.svg.** {*;}

# === Image picker / file system ===
-keep class com.imagepicker.** { *; }
-keep class com.rnfs.** { *; }
