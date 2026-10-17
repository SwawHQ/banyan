export async function setTheme(page,mode) {
  await page.evaluate(theme=>{
    document.documentElement.dataset.theme=theme;
    // Flush style calculation before observing the resulting color transitions.
    getComputedStyle(document.body).backgroundColor;
  },mode);
  await page.waitForFunction(()=>document.getAnimations().filter(animation=>'transitionProperty' in animation)
    .every(animation=>['finished','idle'].includes(animation.playState)));
}
