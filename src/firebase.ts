import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as _signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
// testConnection();

export const signIn = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        // Automatically create user doc if it doesn't exist
        const userRef = doc(db, 'users', result.user.uid);
        try {
            await setDoc(userRef, {
                email: result.user.email,
                createdAt: new Date().toISOString()
            }, { merge: true });
        } catch(err) {
            console.error("No se pudo registrar en la base de datos", err);
        }
    } catch (e) {
        console.error("Login failed", e);
    }
};

export const signOut = () => {
    return _signOut(auth);
};
