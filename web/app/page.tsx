"use client";

import { motion } from "framer-motion";
import {
  Mail,
  Eye,
  BarChart3,
  Chrome,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Bell,
  MousePointerClick,
  Send,
  Sparkles,
  LayoutDashboard,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession } from "next-auth/react";

// ─── Change this to your actual GitHub release URL ──────────
const EXTENSION_DOWNLOAD_URL =
  "https://github.com/ayushkcs/Trackio/releases/latest/download/trackio_extension.zip";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LandingPage() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                Trackio
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#download"
                className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
              >
                Download
              </a>
            </div>
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <Link href="/dashboard">
                  <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200 border-0">
                    <LayoutDashboard className="w-4 h-4 mr-1.5" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button
                      variant="ghost"
                      className="text-gray-700 hover:text-orange-600 hover:bg-orange-50"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200 border-0">
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-orange-200/40 to-amber-200/40 rounded-full blur-3xl" />
          <div className="absolute top-20 -left-40 w-80 h-80 bg-gradient-to-br from-yellow-200/30 to-orange-200/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-gradient-to-br from-rose-200/20 to-amber-200/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 text-sm text-orange-700 mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4" />
              Free & Open Source
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight">
              Know When Your
              <br />
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Emails Get Opened
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              A lightweight Chrome extension that tracks email opens in
              real-time. Get instant analytics on every email you send from
              Gmail.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-6 text-lg shadow-xl shadow-orange-200/50 border-0 rounded-xl"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a
                href={EXTENSION_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-lg border-orange-200 text-orange-700 hover:bg-orange-50 rounded-xl"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Extension
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            className="mt-20 relative"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="relative mx-auto max-w-5xl">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-2xl blur-2xl" />
              <div className="relative bg-white rounded-2xl shadow-2xl shadow-orange-100/50 border border-orange-100/50 overflow-hidden">
                {/* Browser bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 bg-white rounded-lg text-xs text-gray-400 border border-gray-200 min-w-[300px] text-center">
                      trackio.ayushk.blog/dashboard
                    </div>
                  </div>
                </div>
                {/* Mock Dashboard */}
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      {
                        label: "Total Tracked",
                        value: "1,247",
                        change: "+12%",
                      },
                      {
                        label: "Emails Opened",
                        value: "892",
                        change: "+8%",
                      },
                      {
                        label: "Open Rate",
                        value: "71.5%",
                        change: "+3.2%",
                      },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-gradient-to-br from-orange-50/80 to-amber-50/50 border border-orange-100/50"
                      >
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">
                          {stat.value}
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          {stat.change} this week
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        to: "john@company.com",
                        subject: "Q4 Report",
                        opens: 5,
                        time: "2 min ago",
                      },
                      {
                        to: "sarah@startup.io",
                        subject: "Partnership Proposal",
                        opens: 3,
                        time: "1 hour ago",
                      },
                      {
                        to: "jeff@amazon.com",
                        subject: "Hey Jeff, Hire me!",
                        opens: 1,
                        time: "3 hours ago",
                      },
                    ].map((email, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-orange-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-xs font-bold">
                            {email.to[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {email.subject}
                            </p>
                            <p className="text-xs text-gray-400">{email.to}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-orange-600">
                            <Eye className="w-3.5 h-3.5" />
                            <span className="text-sm font-medium">
                              {email.opens}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {email.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-orange-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Track Smarter
              </span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Powerful features designed to give you complete visibility into
              your email engagement.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                icon: Eye,
                title: "Real-Time Open Tracking",
                description:
                  "Know the instant someone opens your email. Get precise timestamps and open counts for every message.",
                gradient: "from-orange-500 to-rose-500",
                bg: "from-orange-50 to-rose-50",
              },
              {
                icon: BarChart3,
                title: "Detailed Analytics",
                description:
                  "Beautiful dashboard with open rates, engagement metrics, and historical data for all your tracked emails.",
                gradient: "from-amber-500 to-orange-500",
                bg: "from-amber-50 to-orange-50",
              },
              {
                icon: Chrome,
                title: "Seamless Gmail Integration",
                description:
                  "Lightweight Chrome extension that works silently in the background. No extra steps when composing emails.",
                gradient: "from-yellow-500 to-amber-500",
                bg: "from-yellow-50 to-amber-50",
              },
              {
                icon: Zap,
                title: "Instant Notifications",
                description:
                  "Get notified right away when someone opens your email. Never miss an engagement opportunity.",
                gradient: "from-orange-500 to-amber-500",
                bg: "from-orange-50 to-amber-50",
              },
              {
                icon: Shield,
                title: "Privacy Focused",
                description:
                  "We never read your email content. Only minimal metadata is stored to power your tracking analytics.",
                gradient: "from-rose-500 to-orange-500",
                bg: "from-rose-50 to-orange-50",
              },
              {
                icon: CheckCircle2,
                title: "Read Receipts in Gmail",
                description:
                  "See checkmark icons right in your Gmail Sent folder. Instantly know which emails have been opened.",
                gradient: "from-amber-500 to-yellow-500",
                bg: "from-amber-50 to-yellow-50",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                className="group relative p-6 rounded-2xl bg-white border border-gray-100 hover:border-orange-200 shadow-sm hover:shadow-xl hover:shadow-orange-100/50 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  {/* Keep it simple so icons are always visible */}
                  <feature.icon className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Up & Running in{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                3 Simple Steps
              </span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Start tracking your emails in under 2 minutes. No complex setup
              required.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                step: "01",
                icon: Chrome,
                title: "Install Extension",
                description:
                  "Download the Trackio Chrome extension and sign in with your Google account.",
              },
              {
                step: "02",
                icon: Send,
                title: "Send Emails",
                description:
                  "Compose and send emails as usual in Gmail. Trackio automatically adds invisible tracking.",
              },
              {
                step: "03",
                icon: Bell,
                title: "Track Opens",
                description:
                  "View real-time open notifications and detailed analytics on your dashboard.",
              },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeInUp} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-orange-300 to-transparent" />
                )}
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 mb-6">
                    <item.icon className="w-10 h-10 text-orange-500" />
                  </div>
                  <div className="absolute -top-2 -right-2 md:left-[60%] w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              { value: "10K+", label: "Active Users" },
              { value: "1M+", label: "Emails Tracked" },
              { value: "99.9%", label: "Uptime" },
              { value: "< 1s", label: "Tracking Speed" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                className="text-center text-white"
              >
                <p className="text-4xl sm:text-5xl font-extrabold">
                  {stat.value}
                </p>
                <p className="mt-2 text-orange-100 text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-24 bg-gradient-to-b from-orange-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              See It{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                In Action
              </span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Here&apos;s how Trackio works seamlessly inside your Gmail
              workflow.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-center"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="space-y-6">
              {[
                {
                  icon: MousePointerClick,
                  title: "Compose your email",
                  desc: "Write your email in Gmail as you normally would. No extra buttons or workflows.",
                },
                {
                  icon: Send,
                  title: "Click Send",
                  desc: "Trackio automatically injects an invisible tracking pixel before your email is sent.",
                },
                {
                  icon: Eye,
                  title: "Track every open",
                  desc: "See real-time notifications when recipients open your email, with timestamp and count.",
                },
                {
                  icon: CheckCircle2,
                  title: "Check your Sent folder",
                  desc: "Checkmark icons appear in Gmail showing which sent emails have been read.",
                },
              ].map((step, i) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center group-hover:from-orange-200 group-hover:to-amber-200 transition-colors">
                    <step.icon className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {step.title}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">{step.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
            <motion.div
              variants={fadeInUp}
              className="relative p-1 rounded-2xl bg-gradient-to-br from-orange-200 to-amber-200"
            >
              <div className="bg-white rounded-xl p-6 space-y-4">
                {/* Mock Gmail compose */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="font-medium text-gray-800">New Message</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-xs text-orange-600 font-medium">
                      Trackio Active
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-12">To:</span>
                    <span className="text-gray-700">client@company.com</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-12">Subject:</span>
                    <span className="text-gray-700">
                      Project Proposal - Q1 2026
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 min-h-[120px] text-sm text-gray-600">
                  Hi there,
                  <br />
                  <br />
                  Please find attached our project proposal for Q1...
                  <div className="mt-4 inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-50 border border-orange-200 text-xs text-orange-600">
                    <Eye className="w-3 h-3" />
                    Tracking pixel will be injected
                  </div>
                </div>
                <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0">
                  <Send className="w-4 h-4 mr-2" />
                  Send & Track
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Download CTA */}
      <section id="download" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="relative p-12 rounded-3xl bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border border-orange-100">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-500/5 to-amber-500/5" />
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
                  <Chrome className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  Ready to Track Your Emails?
                </h2>
                <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
                  Install the Chrome extension and start getting insights into
                  your email engagement today.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href={EXTENSION_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-6 text-lg shadow-xl shadow-orange-200/50 border-0 rounded-xl"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download Extension — It&apos;s Free
                    </Button>
                  </a>
                  <Link href={isLoggedIn ? "/dashboard" : "/login"}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-8 py-6 text-lg border-orange-200 text-orange-700 hover:bg-orange-50 rounded-xl"
                    >
                      {isLoggedIn ? "Open Dashboard" : "View Dashboard"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </div>
                <p className="mt-4 text-sm text-gray-400">
                  Works with Gmail • Free forever
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                Trackio
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a
                href="#features"
                className="hover:text-orange-600 transition-colors"
              >
                Features
          </a>
          <a
                href="#how-it-works"
                className="hover:text-orange-600 transition-colors"
              >
                How It Works
              </a>
              <Link
                href="/login"
                className="hover:text-orange-600 transition-colors"
              >
                Dashboard
              </Link>
            </div>
            <p className="text-sm text-gray-400">
              Built by{" "}
              <a
                href="https://ayushk.blog/"
            target="_blank"
            rel="noopener noreferrer"
                className="underline-offset-2 hover:underline hover:text-orange-600"
          >
                Ayush
          </a>
              .
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
