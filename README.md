# AI-Powered Recruitment & Applicant Tracking System

A full-stack hiring and job application system built for Airship Express, designed to make recruitment faster and easier for both HR teams and job seekers. The platform features an AI engine powered by Google Gemini that automatically screens resumes, scores candidate qualifications, and provides a 24/7 chatbot assistant for real-time application status lookups and company inquiries.

---

## Group Members & Roles

- **dela Cruz, Mary Rianne Kurtney** – Project Leader / Lead Documenter / Quality Assurance (QA) Tester
- **Bernardo, Edralene Mae A.** – Documentation / Data Analyst
- **Diez, Ailyn** – Quality Assurance (QA) Analyst / System Analyst
- **Ferrer, Nathaniel D.** – Full-Stack Developer
- **Inzon, Elaine Joy G.** – UI Designer / Documentation

---

## Tech Stack

- **Frontend:** React.js, Vite, Tailwind CSS
- **Backend:** PHP (Custom REST API)
- **Database:** MySQL
- **AI & Services:** Google Gemini API, PHPMailer (Gmail SMTP), smalot/pdfparser
- **Testing:** Vitest, React Testing Library
- **Tools & Version Control:** Git, GitHub, VS Code, XAMPP

---

## System Requirements & Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- [Node.js (v18+)](https://nodejs.org/)
- [XAMPP (PHP 8.1+ with Apache & MySQL)](https://www.apachefriends.org/)
- [Composer](https://getcomposer.org/)
- [Git](https://git-scm.com/)

---

## Installation & Setup Instructions

Follow these step-by-step instructions to set up the project locally:

### 1. Clone the Repository

```bash
git https://github.com/Nathanielferrer/Nathanielferrer-airship-hiring-system.git
cd Nathanielferrer-airship-hiring-system
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Install Backend Dependencies

```bash
cd ../backend
php composer.phar install
```

### 4. Configure Environment Variables

#### Backend (`backend/.env`)

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your credentials:

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=
DB_NAME=hiring_db

JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_SECRET_KEY
JWT_EXPIRY_SECONDS=86400

GEMINI_API_KEYS=YOUR_GEMINI_API_KEY

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here

ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost/Hiring%20System/backend
```

#### Frontend (`frontend/.env`)

```bash
cp frontend/.env.example frontend/.env
```

Open `frontend/.env` and verify the API base URL:

```env
VITE_API_BASE_URL=http://localhost/Hiring%20System/backend
```

---

## Database Setup & Configuration

Follow these steps to configure your local database:

1. **Start your local database server** — Open XAMPP and start **Apache** and **MySQL**.

2. **Create a new database:**
   - Open phpMyAdmin at [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
   - Create a new database named: `hiring_db`

3. **Import the Database Schema:**
   - Locate the SQL export file: `database/hiring_db.sql`
   - In phpMyAdmin, select the `hiring_db` database → click **Import** → choose the `hiring_db.sql` file → click **Go**.

4. **Verify Configuration:**
   - Make sure your `backend/.env` file has `DB_NAME=hiring_db` matching the database you just created.

---

## Running the Application

### 1. Start XAMPP

Open XAMPP Control Panel and start **Apache** and **MySQL**.

### 2. Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

### 3. Open in Browser

Navigate to: [http://localhost:5173](http://localhost:5173)

> **Note:** The backend runs through XAMPP Apache (no separate server start needed). Make sure the project folder is located inside `C:\xampp\htdocs\`.

---

## Default Login Credentials

| Role         | Email                              | Password        |
|--------------|------------------------------------|-----------------|
| Super Admin  | airship.express07@gmail.com        | Password@123    |
| Admin (HR)   | airshipexpress2016@gmail.com       | Password@123    |
| Applicant    | nathanielferrer691@gmail.com       | Password@123    |

---

## Key Features

- **AI Resume Screening** — Automatically parses uploaded resumes and scores candidate qualifications against job descriptions using Google Gemini.
- **Multi-Stage Applicant Tracking** — Visual pipeline from Screening → Initial Interview → Final Approval → Pre-Employment → Day 1 Onboarding.
- **24/7 AI Chatbot** — Database-connected assistant that answers applicant status queries, job availability, and company FAQs in real time.
- **Dynamic Knowledge Base** — Admin-managed CMS that updates the chatbot's knowledge instantly without code changes.
- **Real-Time Slot Management** — Live job vacancy counters with automatic job closure when all slots are filled.
- **Email Notifications** — Automated email alerts for application updates, interview schedules, and account verification via Gmail SMTP.
- **Role-Based Access** — Separate dashboards and permissions for Applicants, Admins, and Super Admins.

