# LMS Frontend

This is the frontend application for the Learning Management System (LMS) built with React, TypeScript, and Tailwind CSS.

## Features

- User authentication (login/signup)
- Role-based access control (student, teacher, admin)
- Protected routes
- Responsive design with Tailwind CSS
- JWT-based authentication

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router DOM
- Axios
- Tailwind CSS

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
  ├── components/     # Reusable components
  ├── context/       # React Context providers
  ├── hooks/         # Custom React hooks
  ├── pages/         # Page components
  ├── services/      # API services
  ├── App.tsx        # Main App component
  └── main.tsx       # Entry point
```

## Development

The development server runs on port 3000 by default. The application is configured to proxy API requests to the backend server running on port 5000.

## Authentication

The application uses JWT (JSON Web Tokens) for authentication. The token is stored in localStorage and automatically included in API requests.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint 