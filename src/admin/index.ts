import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/prisma';
import { prisma } from '../config';
import bcrypt from 'bcrypt';

AdminJS.registerAdapter({ Database, Resource });

const adminJs = new AdminJS({
  databases: [prisma],
  rootPath: '/admin',
  branding: {
    companyName: 'CodeClash Admin',
  },
});

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  adminJs,
  {
    authenticate: async (email:string, password:string) => {
      // Find user by email
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !user.isAdmin || !user.password) return null;
      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return null;
      return { email: user.email, id: user.id };
    },
    cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'admin-cookie-secret',
  }
);

export { adminJs, adminRouter }; 