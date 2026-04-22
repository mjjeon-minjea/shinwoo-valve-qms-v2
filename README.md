# Shinwoo Valve QMS Homepage

> **Note for AI Assistants**: Please refer to `GEMINI.md` and the `.agent/rules/` directory for communication preferences (Korean language enforcement) and project guidelines.

A modern, responsive homepage for Shinwoo Valve's Quality Management System (QMS), built with React, Vite, and Tailwind CSS.

## Features

- **Modern UI/UX**: Clean blue and white aesthetic tailored for trustworthiness and professionalism.
- **Hero Section**: Engaging split-screen layout with motion effects.
- **Authentication**: Integrated Login/Sign Up toggle form.
- **Dashboard**: Secure area placeholder that triggers upon successful login.
- **Responsive Design**: Fully optimized for mobile, tablet, and desktop.

## Prerequisites

Before running this project, ensure you have **Node.js** installed on your system.
[Download Node.js](https://nodejs.org/)

## Getting Started

1. **Install Dependencies**
   Open your terminal in this directory and run:

   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
3. **Build for Production**
   ```bash
   npm run build
   ```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── Header.jsx      # Navigation bar
│   │   ├── Hero.jsx        # Landing page with auth form
│   │   └── Dashboard.jsx   # Post-login content
│   ├── App.jsx             # Main router & state
│   └── index.css           # Tailwind imports
├── tailwind.config.js      # Design system configuration
└── vite.config.js          # Build configuration
```

## Technologies

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/) (Icons)
