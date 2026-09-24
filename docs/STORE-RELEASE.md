# Releasing Roman's Game on the App Store and Google Play

This is the leftover work only a person can do. The app project is already in the repo. You do not need to change the puzzle, the voices, or the website.

The website can sell the three larger coin packs by card once it is hosted on Netlify. The $0.99 pouch stays in the apps only. The iPhone and Android apps still use App Store / Google Play only and do not offer the website checkout.

Share links use `PUBLIC_GAME_URL` in `src/game/publicUrl.ts` (`https://romans-game.netlify.app`), so a shared link opens the site that can take payment.

## The name and the placeholder id

- App name: **Roman's Game**
- Placeholder bundle id / application id: **`com.originx1a.romangame`**

That id is a stand-in. Change it to the real one you own before you create the store listings. It lives in `capacitor.config.ts` (`appId`). After you change it, someone technical runs:

```bash
npm run build
npx cap sync
```

Use the same id in Apple, Google, and that file. The four coin products below keep their own ids. Those product ids do not change when the bundle id changes.

## 1. Accounts

- [ ] Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) (paid). You need a Mac to upload the iPhone app.
- [ ] Create a [Google Play Console](https://play.google.com/console) developer account (paid).

## 2. Create the four coin products

Create these as **consumable** in-app products (Apple: consumable. Google: one-time product / consumable). The ids must match exactly.

| Product id | Name in the game | Coins | Price hint |
| --- | --- | --- | --- |
| `roman.coins.100` | Coin Pouch | 100 | about $0.99 |
| `roman.coins.500` | Coin Bag | 500 | about $4.99 |
| `roman.coins.1200` | Coin Chest | 1200 | about $9.99 |
| `roman.coins.3000` | Coin Vault | 3000 | about $19.99 |

The price hint is only a suggestion. You set the real price in each store. The app shows the store’s price when the phone can load it.

Suggested description for each: “Coins for hints, rescues, revives, and badge ranks in Roman's Game.”

Coins are added only after the store finishes a successful purchase. Cancel, a payment that is still waiting, or a failure does not add coins.

### Why “Restore purchases” does not give old coins back

These packs are consumable. Once a purchase is finished, Apple and Google treat the coins as spent. They will not send that purchase again. The Restore button in the Rewards screen only finishes a payment that was charged but not yet turned into coins (for example the app closed in the middle). That is the right behavior for coin packs. Do not switch these products to non-consumable.

## 3. Signing keys

### iPhone

- [ ] On a Mac, open `ios/App/App.xcworkspace` if it exists, otherwise `ios/App/App.xcodeproj`.
- [ ] The first open downloads the Capacitor Swift package (needs a network connection). This project uses Swift Package Manager, not CocoaPods.
- [ ] Select the App target → Signing & Capabilities.
- [ ] Choose your Team.
- [ ] Add the **In-App Purchase** capability.
- [ ] Let Xcode manage signing, or use the distribution certificate you already have.

`npx cap sync ios` copies the built game into the Xcode project and registers the purchase plugin. It does not need a Mac. Building and uploading still need a Mac.

### Android

- [ ] Create an upload key if you do not have one. On a computer with Java:

```bash
keytool -genkey -v -keystore roman-upload.keystore -alias roman -keyalg RSA -keysize 2048 -validity 10000
```

- [ ] Keep `roman-upload.keystore` and the passwords somewhere safe and offline. If you lose them, you cannot update the app.
- [ ] Do not commit the keystore or the passwords to git.
- [ ] In Play Console, turn on Play App Signing. Google holds the app signing key. You keep the upload key.
- [ ] Put the upload key into `android/keystore.properties` (this file is not in git) or sign from Android Studio. A debug build for testing on your own phone does not need this key.

## 4. Test purchases without spending money

You do not need a real charge to test.

### iPhone

Two ways:

1. **On your Mac, no store account required.** The shared Xcode scheme already uses `ios/App/App/RomanCoins.storekit`, which lists the four coin products. Run the app from Xcode on the simulator. The purchase sheet is a test sheet. No money moves. If that file is not selected: Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration → RomanCoins.storekit.
2. **Sandbox Apple ID.** In App Store Connect → Users and Access → Sandbox → create a tester. On the iPhone, sign out of the real App Store, run the app, and sign in with the sandbox tester when the purchase sheet asks. Sandbox testers are not charged.

### Android

Google only allows real billing tests on a build installed from Play, signed with your upload key.

- [ ] Upload an internal-testing build (see below).
- [ ] Play Console → Settings → License testing → add the Gmail accounts that will test.
- [ ] Those accounts can buy the test products without a real charge.
- [ ] Wait until the products are Active. A brand-new product can take a few hours.

A debug APK installed with a cable (`assembleDebug`) will compile, but Google Play Billing will not complete a purchase until the app is installed from an internal testing track.

To see store logs on a device, in the app’s WebView debug console set local storage key `roman.iap.debug` to `1`, then reopen the app. Turn it off again before you ship.

## 5. Build and upload the iPhone app

On a Mac, in this project folder:

```bash
npm ci
npm run build
npx cap sync ios
npx cap open ios
```

`cap sync ios` works without a Mac. Xcode is what needs the Mac.

In Xcode:

- [ ] Set the version (for example 1.0.0) and build number.
- [ ] Confirm the bundle id is the real one, not the placeholder, if you changed it.
- [ ] Product → Archive.
- [ ] Distribute App → App Store Connect → Upload.
- [ ] In App Store Connect, fill in the listing, screenshots, the privacy policy URL, and the age rating (answers below).
- [ ] Add the four in-app purchases to the version.
- [ ] Submit for review. Do not click Submit until you mean to.

The privacy page is `public/privacy.html`. Inside the app it is linked from the footer (“Privacy”). App Store Connect also wants a **public web address** for that page. Put `privacy.html` on a website you control and paste that address into the form. Do not assume the game site was updated for you.

## 6. Build and upload the Android app

```bash
npm ci
npm run build
npx cap sync android
```

A debug check (no upload key) is:

```bash
cd android
./gradlew assembleDebug
```

The test file is `android/app/build/outputs/apk/debug/app-debug.apk`.

For Play, build a release app bundle in Android Studio (`npx cap open android` → Build → Generate Signed Bundle) or with Gradle after `keystore.properties` is set up. Upload the `.aab` to an internal testing track first, test the four purchases with a license-tester Gmail, then promote to production.

Play Console also wants a public privacy policy URL. Use the same page as Apple.

## 7. Draft answers for Apple’s age rating

Roman is fictional. The game is a logic puzzle for a general audience. There is no age gate.

Answer **none** for:

- Cartoon or realistic violence, horror, sexual content, nudity, alcohol, drugs, profanity, weapons
- Unrestricted web access, gambling with real money, contests that pay real prizes
- Advertising (there are no ads)

Answer **yes** for in-app purchases. They are consumable coin packs. Coins buy hints, rescues, revives, and badge ranks.

There is a prize wheel. Spins are earned by playing (catch sparks). They are not bought. The wheel pays in-game items only, never money. If a question asks about simulated gambling or loot boxes, say that plainly and pick the mildest “yes” the form allows (infrequent / mild) rather than hiding the wheel. If the form’s definition clearly does not include a free gameplay reward, “none” is fair. Do not describe it as paid gambling.

No user-to-user chat. Sharing is a link the player chooses to send.

## 8. Draft answers for Google’s content rating (IARC)

Same facts as Apple:

- General audience puzzle
- No violence, sexual content, language, or controlled substances
- No ads
- In-app purchases: yes (consumable coins)
- Digital purchases can be made
- No user interaction between people inside the app (no chat)
- Shares a link out to other apps the player already has
- No location collection
- The prize wheel is a free in-game reward, not a cash contest

Use the IARC questionnaire in Play Console. The rating should come out suitable for general audiences (everyone / PEGI 3 style), with in-app purchases disclosed.

## 9. Privacy forms (Apple nutrition labels and Google Data safety)

Match the in-app privacy page.

Data the game stores **on the device only**:

- Game progress, coins, and settings
- Email and display name, only if the player types them into Save
- Optional friend email typed for a challenge
- Purchase transaction ids, so a finished purchase is not counted twice

Not collected by the developer:

- No analytics
- No advertising id
- No location
- No contacts
- No microphone recordings (voice is the device reading lines out loud, plus sound files shipped in the app)
- Purchase receipts are not sent to the developer or to a receipt-checking company. Apple or Google still process the payment themselves.

Data is not sold. Deleting the app deletes the save.

## 10. Quick check before you submit

- [ ] Real bundle id in `capacitor.config.ts`, Apple, and Google
- [ ] Four products exist, consumable, ids exact, attached to the app version
- [ ] You bought each pack once in sandbox / license testing and the coin count went up
- [ ] You cancelled a purchase and the coin count did not change
- [ ] The website still shows the packs as “App Store / Play” and will not take payment
- [ ] Privacy policy URL opens in a browser
- [ ] Screenshots show the puzzle, not only the shop
- [ ] You did not commit the upload keystore
