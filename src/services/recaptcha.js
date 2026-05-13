import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../firebase"; // 👈 correct path

export const setupRecaptcha = () => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      "recaptcha-container",
      {
        size: "invisible"
      },
      auth
    );
  }
};