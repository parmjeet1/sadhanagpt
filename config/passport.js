import { configDotenv } from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// import { googleLogin } from "../SadhanaGPT/Student/Controllers/StudentController.js";
configDotenv();
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {

         const googleId = profile.id;
        const name = profile.displayName;
        const email = profile.emails[0].value;
        const profile =""; //profile.photos[0].value;
        // const resp = await googleLogin({
        //   googleId,
        //   name,
        //   email,
        //   profile,
        // });

console.log("working testing")
        return done(null, { googleId, name, email, profile });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
