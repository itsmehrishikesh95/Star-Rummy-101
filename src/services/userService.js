import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export async function createUserProfile(uid, phone) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      phone,
      name: '',
      coins: 5000,
      avatar: 1,
      createdAt: serverTimestamp(),
      gamesPlayed: 0,
      gamesWon: 0
    })
  }
  const updated = await getDoc(ref)
  return updated.data()
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

export async function updateUserCoins(uid, newCoins) {
  await setDoc(doc(db, 'users', uid), { coins: newCoins }, { merge: true })
}