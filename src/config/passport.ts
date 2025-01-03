import passport from "passport";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from "passport-github2";
import { prisma } from ".";
import jwt from "jsonwebtoken";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: GoogleProfile,
      done: (error: Error | null, user?: { tempOAuthToken: string }) => void
    ) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(new Error("No email found in Google profile"));
        }

        let user = await prisma.user.findUnique({
          where: { email },
        });
        const tempOAuthToken = jwt.sign({ email }, process.env.TEMP_JWT_SECRET!, { expiresIn: "1m" });

        if (user) {
          const updateData: {
            profileImage: string | null;
            isVerified: boolean;
            tempOAuthToken: string;
            googleId?: string;
          } = {
            profileImage: profile.photos?.[0]?.value || null,
            isVerified: true,
            tempOAuthToken,
          };

          if (!user.googleId) {
            updateData.googleId = profile.id;
          }

          user = await prisma.user.update({
            where: { email },
            data: updateData,
          });
        } else {
          user = await prisma.user.create({
            data: {
              email,
              username: profile.displayName,
              profileImage: profile.photos?.[0]?.value || null,
              googleId: profile.id,
              isVerified: true,
              tempOAuthToken,
            },
          });
        }

        done(null, { tempOAuthToken });
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: `${process.env.BASE_URL}/auth/github/callback`,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: GitHubProfile,
      done: (error: Error | null, user?: { tempOAuthToken: string }) => void
    ) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email found in GitHub profile"));
        }

        let user = await prisma.user.findUnique({
          where: { email },
        });
        const tempOAuthToken = jwt.sign({ email }, process.env.TEMP_JWT_SECRET!, { expiresIn: "1m" });

        if (user) {
          const updateData: {
            profileImage: string | null;
            isVerified: boolean;
            tempOAuthToken: string;
            githubId?: string;
          } = {
            profileImage: profile.photos?.[0]?.value || null,
            isVerified: true,
            tempOAuthToken,
          };

          if (!user.githubId) {
            updateData.githubId = profile.id;
          }

          user = await prisma.user.update({
            where: { email },
            data: updateData,
          });
        } else {
          user = await prisma.user.create({
            data: {
              email,
              username: profile.username || profile.displayName || "GitHub User",
              profileImage: profile.photos?.[0]?.value || null,
              githubId: profile.id,
              isVerified: true,
              tempOAuthToken,
            },
          });
        }

        done(null, { tempOAuthToken });
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

export default passport;
