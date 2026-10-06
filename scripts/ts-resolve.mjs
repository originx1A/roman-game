// Test-only resolve hook: lets node load the app's extensionless TS imports ('./lineBag' → './lineBag.ts').
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (err) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.ts`, context)
    }
    throw err
  }
}
