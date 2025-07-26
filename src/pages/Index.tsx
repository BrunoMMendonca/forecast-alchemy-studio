import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, Brain, TrendingUp, Users, Shield, Zap, Upload, Server } from 'lucide-react';
import { motion } from 'framer-motion'; // For animations
import { FaQuoteLeft, FaTwitter, FaLinkedin } from 'react-icons/fa'; // Corrected import

const Index = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/onboarding');
  };

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const stagger = {
    animate: { transition: { staggerChildren: 0.1 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-indigo-100 overflow-hidden">
      {/* Header with Glassmorphism */}
      <header className="bg-white/70 backdrop-blur-md border-b border-cyan-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <motion.div
              className="flex items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <span className="text-3xl md:text-4xl font-extrabold text-black" style={{ fontFamily: 'GetVoIP Grotesque' }}>
                FORECAST ALCHEMY
              </span>
            </motion.div>
            <Button
              variant="outline"
              className="border-indigo-500 text-indigo-700 hover:bg-indigo-50 transition-all duration-300"
              onClick={handleGetStarted}
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Video Background */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            className="w-full h-full object-cover opacity-20"
          >
            <source src="/forecast_video.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div className="mb-12" {...fadeInUp}>
            <img
              src="/forecast_alchemy_logo.svg"
              alt="Forecast Alchemy Studio"
              className="h-72 md:h-96 w-auto mx-auto filter drop-shadow-lg"
            />
          </motion.div>
          <motion.h1
            className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight"
            {...fadeInUp}
            transition={{ delay: 0.2 }}
          >
            Transform Data into<br /><span className="text-indigo-600">Actionable Forecasts</span>
          </motion.h1>
          <motion.p
            className="text-xl md:text-2xl text-gray-700 mb-10 max-w-4xl mx-auto"
            {...fadeInUp}
            transition={{ delay: 0.3 }}
          >
            Revolutionize your S&OP planning with AI-powered optimization, no integration hassles, and enterprise-grade accuracy.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            {...stagger}
          >
            <Button
              size="lg"
              className="text-lg px-10 py-6 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
              onClick={handleGetStarted}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-10 py-6 border-indigo-500 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-600 transition-all duration-300"
            >
              Watch Demo
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features Section with Staggered Grid */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Why Choose Forecast Alchemy?
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Cutting-edge features designed for businesses of all sizes, from startups to enterprises.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
            {...stagger}
          >
            {/* No Integration Needed - Highlighted */}
            <motion.div
              className="bg-gradient-to-br from-emerald-50 to-green-100 p-8 rounded-xl shadow-xl border-2 border-emerald-300 relative overflow-hidden"
              whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}
            >
              <div className="w-16 h-16 bg-emerald-200 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Upload className="h-8 w-8 text-emerald-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No Integration Needed</h3>
              <p className="text-gray-700 mb-4">
                Upload your CSV and forecast instantly. Skip costly ERP integrations.
              </p>
              <div className="text-sm text-emerald-800 bg-emerald-200/80 px-4 py-2 rounded-full">
                Save <strong>$50K+</strong> and <strong>Months </strong>of integration time


              </div>
              <span className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">Key Benefit</span>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <Brain className="h-8 w-8 text-blue-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Optimization</h3>
              <p className="text-gray-700">
                AI finds the best models and parameters for your data.
              </p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="h-8 w-8 text-green-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Multi-Model Analysis</h3>
              <p className="text-gray-700">
                Compare ARIMA, SARIMA, and more side-by-side.
              </p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8 text-purple-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">S&OP Integration</h3>
              <p className="text-gray-700">
                Align with your S&OP cycles for strategic planning.
              </p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                <Users className="h-8 w-8 text-orange-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Multi-Tenant</h3>
              <p className="text-gray-700">
                Manage complex hierarchies with ease.
              </p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-red-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Enterprise Security</h3>
              <p className="text-gray-700">
                Secure access with role-based controls.
              </p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                <Zap className="h-8 w-8 text-yellow-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Lightning Fast</h3>
              <p className="text-gray-700">
                Optimized for large datasets with caching.
              </p>
            </motion.div>

            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200"
              whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-6">
                <Server className="h-8 w-8 text-teal-700" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Scalable Infrastructure</h3>
              <p className="text-gray-700">
                Handle millions of data points effortlessly.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section with Glassmorphism */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white/30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6"
            {...fadeInUp}
          >
            Ready to Revolutionize Your Forecasting?
          </motion.h2>
          <motion.p
            className="text-lg text-gray-700 mb-10 max-w-2xl mx-auto"
            {...fadeInUp}
            transition={{ delay: 0.2 }}
          >
            Join industry leaders who trust Forecast Alchemy for precise, actionable insights.
          </motion.p>
          <motion.div {...fadeInUp} transition={{ delay: 0.3 }}>
            <Button
              size="lg"
              className="text-lg px-10 py-6 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300"
              onClick={handleGetStarted}
            >
              Get Started Now
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer with Testimonials and Socials */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div className="mb-6" {...fadeInUp}>
            <FaQuoteLeft className="h-8 w-8 text-cyan-400 mx-auto mb-4" />
            <p className="text-lg italic text-gray-300 max-w-xl mx-auto">
              "Forecast Alchemy transformed our demand planning—accurate forecasts with zero integration hassle!"
              <span className="block mt-2 font-semibold text-white">- Acme Corp</span>
            </p>
          </motion.div>
          <div className="flex justify-center gap-6 mb-6">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
              <FaTwitter className="h-6 w-6 text-gray-400 hover:text-cyan-400 transition-colors" />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
              <FaLinkedin className="h-6 w-6 text-gray-400 hover:text-cyan-400 transition-colors" />
            </a>
          </div>
          <p className="text-sm text-gray-500">
            © 2025 Forecast Alchemy Studio. All rights reserved. |{' '}
            <a href="/terms" className="underline hover:text-cyan-400">Terms</a> |{' '}
            <a href="/privacy" className="underline hover:text-cyan-400">Privacy</a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;