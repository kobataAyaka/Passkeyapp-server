// 必要なライブラリのインポート [3-5]
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const generateRegistrationOptions = require("@simplewebauthn/server").generateRegistrationOptions; // FIDO2 (WebAuthn) のパスキー登録オプション生成 [3, 8]
const verifyRegistrationResponse = require("@simplewebauthn/server").verifyRegistrationResponse; // FIDO2 (WebAuthn) のパスキー登録検証 [3, 8]
const verifyAuthenticationResponse = require("@simplewebauthn/server").verifyAuthenticationResponse;
// const TrinsicService = require('@trinsic/trinsic').TrinsicService; // Trinsicのサービスを利用 [3, 5]

// Express アプリケーションの初期化 [3, 4]
const app = express();

// CORS ミドルウェアの適用 [4]
// 'origin: true' は、リクエスト元のオリジンを許可します。 [4]
// 本番環境では、iOSアプリの特定のドメインを指定する方がより安全です。
app.use(cors({origin: true}));

// JSON ボディパーサーの適用 [3, 4]
// クライアントからのJSONリクエストボディをパースするために必要です。
const express = require("express");
const json = express.json;

// Trinsic Service の初期化 [3, 5]
// YOUR_TRINSIC_API_KEY は、Trinsicダッシュボードで取得したAPIキーに置き換えてください。 [9, 10]
// Firebase Secret Manager を使用して安全に管理することを推奨します。 [10, 11]
// const trinsic = new TrinsicService({ authToken: process.env.TRINSIC_API_KEY || 'YOUR_TRINSIC_API_KEY_HERE' });

// --- FIDO2 (WebAuthn) 関連のエンドポイント ---

// パスキー（FIDO2）の登録オプション（チャレンジ）生成エンドポイント [8, 12]
// iOSアプリがパスキー登録を開始する際に呼び出します。
app.get("/fido/register", async (req, res) => {
  try {
    // WebAuthnのチャレンジを生成 [12, 13]
    // rpName: アプリケーション名、rpID: Relying Party ID (Firebaseのドメイン) [8, 14]
    // userID, userName: ユーザーの識別子。実際にはデータベースから取得します。
    const options = await generateRegistrationOptions({
      rpName: "Your Demo App",
      rpID: "passkeyapp.firebaseapp.com", // **Firebaseプロジェクトのドメインに置き換えてください [7, 8, 14]**
      userID: "unique_user_id_from_db", // データベースから取得したユニークなユーザーID [8]
      userName: "user@example.com", // ユーザー名 (登録プロンプトに表示) [15]
      authenticatorSelection: {authenticatorAttachment: "platform"}, // パスキーを使うデバイスの選択 [16]
    });

    // 生成したチャレンジは、後続の検証のために一時的にサーバー側で保存する必要があります [14, 17].
    // デモ目的であれば、ここではレスポンスとして直接返しますが、実際にはFirestoreなどに保存します [8, 11]。
    // 例: await admin.firestore().collection('challenges').doc('user_id').set({ challenge: options.challenge });

    res.json(options);
  } catch (error) {
    console.error("Error generating FIDO registration options:", error);
    res.status(500).json({error: error.message});
  }
});

// パスキー（FIDO2）の登録検証エンドポイント [8, 18]
// iOSアプリから送信されたパスキー登録結果を検証します。
app.post("/fido/verify", async (req, res) => {
  try {
    const {body} = req;
    // 登録時に保存しておいたチャレンジをデータベースから取得します [8, 11, 14, 17]
    // 例: const expectedChallenge = (await admin.firestore().collection('challenges').doc('user_id').get()).data().challenge;
    const expectedChallenge = "YOUR_SAVED_CHALLENGE"; // **実際にはデータベースから取得したチャレンジに置き換えてください [8]**

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: expectedChallenge,
      expectedOrigin: "https://passkeyapp.firebaseapp.com", // **Firebaseプロジェクトのドメインに置き換えてください [8]**
      expectedRPID: "passkeyapp.firebaseapp.com", // **Firebaseプロジェクトのドメインに置き換えてください [8, 14]**
    });

    // 検証が成功したら、認証器から発行された公開鍵とcredentialIDをユーザーと紐付けてデータベースに安全に保存します [19, 20]。
    // 例: await admin.firestore().collection('users').doc('user_id').set({
    //   credentialID: verification.registrationInfo.credentialID,
    //   publicKey: verification.registrationInfo.credentialPublicKey,
    //   // その他の情報
    // }, { merge: true });

    res.json({verified: verification.verified});
  } catch (error) {
    console.error("Error verifying FIDO registration:", error);
    res.status(400).json({error: error.message});
  }
});

// パスキー（FIDO2）の認証検証エンドポイント (参考として提供。登録と認証はフローが類似) [21]
app.post("/fido/authenticate", async (req, res) => {
  try {
    const {body} = req;
    // データベースから、ユーザーの公開鍵と以前のチャレンジを取得します [21, 22]。
    // 例: const userPublicKey = (await admin.firestore().collection('users').doc('user_id').get()).data().publicKey;
    // 例: const expectedChallenge = (await admin.firestore().collection('challenges').doc('user_id').get()).data().challenge;
    const userPublicKey = "YOUR_SAVED_PUBLIC_KEY"; // **データベースから取得した公開鍵に置き換えてください**
    const expectedChallenge = "YOUR_SAVED_CHALLENGE_FOR_AUTHENTICATION"; // **データベースから取得したチャレンジに置き換えてください**

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: expectedChallenge,
      expectedOrigin: "https://passkeyapp.firebaseapp.com", // **Firebaseプロジェクトのドメインに置き換えてください**
      expectedRPID: "passkeyapp.firebaseapp.com", // **Firebaseプロジェクトのドメインに置き換えてください**
      credentialPublicKey: userPublicKey,
    });

    // 検証が成功すれば、ユーザーのサインインを完了させます [23]。
    res.json({verified: verification.verified});
  } catch (error) {
    console.error("Error verifying FIDO authentication:", error);
    res.status(400).json({error: error.message});
  }
});

// // --- DID/VC (Trinsic/Dentity) 関連のエンドポイント ---

// // DID 生成エンドポイント [18, 24]
// // iOSアプリからDID生成をリクエストする際に呼び出します。
// app.post('/did/create', async (req, res) => {
//   try {
//     // TrinsicのAPIを呼び出してDID（ウォレット）を生成 [24, 25]
//     const wallet = await trinsic.wallet().createWallet({});
//     res.json({ did: wallet.did });
//   } catch (error) {
//     console.error('Error creating DID:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // VC (Verifiable Credential) 発行エンドポイント [5, 24-27]
// // iOSアプリから特定のVCの発行をリクエストする際に呼び出します。
// app.post('/vc/issue', async (req, res) => {
//   try {
//     // req.body.values: VCに含めるデータ (例: { name: "Test User", email: "user@example.com" }) [24, 27]
//     // YOUR_TEMPLATE_ID: Trinsicダッシュボードで作成したVCテンプレートのID [10, 28, 29]
//     const credential = await trinsic.credential().issue({
//       templateId: 'YOUR_TEMPLATE_ID', // **TrinsicのVCテンプレートIDに置き換えてください**
//       values: req.body.values, // クライアントから送信されたVCデータ [24]
//     });
//     res.json({ credential });
//   } catch (error) {
//     console.error('Error issuing VC:', error);
//     res.status(400).json({ error: error.message });
//   }
// });

// // VC (Verifiable Credential) 検証エンドポイント [10, 26, 28, 30]
// // iOSアプリから受け取ったVCを検証する際に呼び出します。
// app.post('/vc/verify', async (req, res) => {
//   try {
//     // req.body.credential: 検証するVCのJSON文字列 [30]
//     const verification = await trinsic.credential().verify({ credential: req.body.credential });
//     res.json({ verification });
//   } catch (error) {
//     console.error('Error verifying VC:', error);
//     res.status(400).json({ error: error.message });
//   }
// });

exports.api = functions.https.onRequest(app);
