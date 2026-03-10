# Trackio

I want to build a full-stack email tracking system called Trackio.

*Project Goal:*

A Chrome Extension that injects a tracking pixel into Gmail's compose window and a Next.js dashboard to monitor 'Open' events and counts.

## Tech Stack

*Monorepo Structure:* 

- `/web` (Next.js, Tailwind)
- `/extension` (Manifest V3, Vanilla JS)

*Backend:* 

- Next.js API Routes hosted on Vercel.

*Database:*

- Use vercel KV database for storing data.

*Frontend:* 

-Shadcn/ui for the dashboard.

## Features

### Dashboard (Next js Vercel)

*Note:* ONLY USE LIGHT MODE EVERYWHERE!

- Use really nice modern UI components and animations everywhere on the website. Use vibrant gradient colors like orangish, yellowish, etc, but not blue.

- Landing Page
- Login Page
- Dashboard Page

- Create a really nice, modern & responsive landing page using vibrant colors explaining all the features like a proper saas. Use light mode only!

    - also, add a link to the chrome extension to download it for the users.

- if the user is not logged in, kindly redirect them to the landing page.

*Login Page:*

- Create a nice login page where user can sign in using google SSO.

*Dashboard Page:*

- Build a 'Stats' dashboard using Tailwind that fetches the list of emails from the DB.

    - Display: Recipient, Subject, Open Count, and Last Opened Timestamp.


## Phase 1: Database & API (Next.js)

- Define a Prisma schema with an Email model (id, recipient, subject, status) and an OpenEvent model (id, emailId, timestamp, ipAddress, userAgent).

- Create a GET API route at `/api/track/[id]` that:

    - Increments the open count in the database.

    - Returns a 1x1 transparent Base64 GIF pixel.

    Sets headers to no-store, no-cache to prevent Gmail proxy caching.

- Create a POST API route at `/api/emails` register for the extension to notify the DB when a new email is being sent.

## Phase 2: Chrome Extension (Manifest V3)

- Create a manifest.json with host_permissions for mail.google.com and your Vercel domain.

- Write a content.js script that:

    - Uses a MutationObserver to detect when a Gmail 'Compose' window is opened.

    - Finds the 'Send' button.

    - On 'Send' click: intercept the event, call the `/api/emails` endpoint to get a unique ID, and append the `<img src=".../api/track/[id]">` tag to the email body before it leaves.

- The "Double Check" Feature: Once you have the basics, ask Gemini to help you write a script that injects a "Checkmark" icon into the Gmail Sent folder UI. This makes Trackio feel like a pro tool (like Mailtrack).

## Phase 3: Dashboard (Next.js UI)

- create a really nice, modern & responsive landing page using vibrant colors explaining all the features like a proper saas. Use light mode only!

- if the user is not logged in, kindly redirect them to the landing page.

- Build a 'Stats' dashboard using Tailwind that fetches the list of emails from the DB.

    - Display: Recipient, Subject, Open Count, and Last Opened Timestamp.

## Constraint

- Do not use complex monorepo tools like Turbo or Nx yet; just keep them as separate folders in one GitHub repo. Use standard Javascript for the extension to keep it lightweight.

*Prevent Self-Opens:*

- Don't accidentally track the user's own Sent folder. Make sure you only count the receipt opening the emails and not the user themself.