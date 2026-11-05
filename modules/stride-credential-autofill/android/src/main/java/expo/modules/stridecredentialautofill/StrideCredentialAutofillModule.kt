package expo.modules.stridecredentialautofill

import android.os.Build
import android.view.autofill.AutofillManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StrideCredentialAutofillModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StrideCredentialAutofill")

    // No username or password crosses this bridge. Android reads its existing
    // autofill view context and the user decides whether their provider saves it.
    AsyncFunction("commitAsync") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction false
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val manager = activity.getSystemService(AutofillManager::class.java)
        ?: return@AsyncFunction false
      if (!manager.isEnabled) return@AsyncFunction false
      manager.commit()
      true
    }.runOnQueue(Queues.MAIN)
  }
}
