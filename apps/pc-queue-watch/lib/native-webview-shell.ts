/** Marks the loaded site as running inside the CollecTools native shell. */
export const NATIVE_APP_SHELL_INJECT = `
(function(){
  try { document.documentElement.classList.add('native-app'); } catch (e) {}
})();
true;
`
