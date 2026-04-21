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
    } catch (e: any) {
        console.error("Login failed", e);
        if (e.code === 'auth/unauthorized-domain') {
            alert(`¡Cuidado! El inicio de sesión falló porque este dominio aún no está autorizado en tu cuenta de Firebase.\n\nPara solucionarlo, ve a tu Consola de Firebase -> Authentication -> Settings -> Authorized domains, y añade el dominio exacto en el que estás alojando esta página (por ejemplo, tudominio.onrender.com).`);
        } else if (e.code === 'auth/popup-closed-by-user') {
            console.log("El usuario cerró la ventana emergente de inicio de sesión.");
        } else {
            alert(`Error al iniciar sesión: ${e.message || 'Error desconocido'}`);
        }
    }
};

export const signOut = () => {
    return _signOut(auth);
};
