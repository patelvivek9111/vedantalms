import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  Users, 
  Calendar, 
  BarChart3, 
  Shield, 
  Zap,
  ArrowRight
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: BookOpen,
      title: "Course Management",
      description: "Create, organize, and deliver engaging courses with our intuitive course builder."
    },
    {
      icon: Users,
      title: "Student Engagement",
      description: "Foster collaboration through discussions, group projects, and interactive assignments."
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Integrated calendar system for assignments, events, and deadlines."
    },
    {
      icon: BarChart3,
      title: "Analytics & Insights",
      description: "Track student progress and course performance with detailed analytics."
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with role-based access control."
    },
    {
      icon: Zap,
      title: "Fast & Responsive",
      description: "Built with modern technologies for optimal performance."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 safe-area-inset">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm safe-area-inset-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center min-w-0 flex-1">
              <img 
                src="/assets/vedanta-logo.png" 
                alt="Vedanta Logo" 
                className="h-8 sm:h-10 w-auto mr-2 sm:mr-3 flex-shrink-0"
                onError={(e) => {
                  // Fallback to icon if logo not found
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <div className="flex items-center" style={{ display: 'none' }}>
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3" />
              </div>
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">VEDANTA</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
              <Link 
                to="/login" 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
              >
                Sign In
              </Link>
              <Link 
                to="/signup" 
                className="bg-blue-600 dark:bg-blue-500 text-white px-3 sm:px-4 py-2 sm:py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20 px-3 sm:px-4 md:px-6 lg:px-8 safe-area-inset-x">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-4 sm:mb-6 md:mb-8 flex justify-center">
            <img 
              src="/assets/vedanta-logo.png" 
              alt="Vedanta Logo" 
              className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto max-w-full"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 leading-tight px-2">
            Modern Learning.
            <span className="text-blue-600 dark:text-blue-400 block mt-1 sm:mt-2">Ancient Wisdom.</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-2 leading-relaxed">
            Vedanta Learning Management System combines cutting-edge technology with timeless educational principles. 
            Empower educators and inspire students with a platform designed for meaningful learning experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2">
            <Link 
              to="/signup" 
              className="bg-blue-600 dark:bg-blue-500 text-white px-6 sm:px-6 md:px-8 py-3.5 sm:py-3.5 md:py-4 rounded-lg text-sm sm:text-base md:text-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors inline-flex items-center justify-center min-h-[44px] touch-manipulation active:scale-95 transition-transform w-full sm:w-auto"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            </Link>
            <Link 
              to="/login" 
              className="border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 sm:px-6 md:px-8 py-3.5 sm:py-3.5 md:py-4 rounded-lg text-sm sm:text-base md:text-lg font-semibold hover:border-gray-400 dark:hover:border-gray-500 transition-colors inline-flex items-center justify-center min-h-[44px] touch-manipulation active:scale-95 transition-transform w-full sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20 px-3 sm:px-4 md:px-6 lg:px-8 bg-white dark:bg-gray-800 safe-area-inset-x">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-8 md:mb-12 lg:mb-16 px-2">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3 md:mb-4 leading-tight">
              Everything You Need to Succeed
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Our comprehensive platform provides all the tools educators and students need 
              for an exceptional learning experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-4 sm:p-5 md:p-6 rounded-lg hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow bg-gray-50 dark:bg-gray-700/50 touch-manipulation active:scale-[0.98] transition-transform">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full mb-3 sm:mb-4">
                  <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{feature.title}</h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20 px-3 sm:px-4 md:px-6 lg:px-8 bg-gray-900 safe-area-inset-x">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 md:mb-4 leading-tight px-2">
            Ready to Begin Your Learning Journey?
          </h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 mb-6 sm:mb-8 leading-relaxed px-2">
            Join Vedanta and experience a learning management system that bridges modern technology 
            with educational excellence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2">
            <Link 
              to="/signup" 
              className="bg-blue-600 text-white px-6 sm:px-6 md:px-8 py-3.5 sm:py-3.5 md:py-4 rounded-lg text-sm sm:text-base md:text-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center justify-center min-h-[44px] touch-manipulation active:scale-95 transition-transform w-full sm:w-auto"
            >
              Get Started Today
            </Link>
            <Link 
              to="/login" 
              className="border-2 border-white text-white px-6 sm:px-6 md:px-8 py-3.5 sm:py-3.5 md:py-4 rounded-lg text-sm sm:text-base md:text-lg font-semibold hover:bg-white hover:text-gray-900 transition-colors inline-flex items-center justify-center min-h-[44px] touch-manipulation active:scale-95 transition-transform w-full sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 py-6 sm:py-8 md:py-10 lg:py-12 px-3 sm:px-4 md:px-6 lg:px-8 safe-area-inset-x safe-area-inset-bottom">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center mb-3 sm:mb-4">
                <img 
                  src="/assets/vedanta-logo.png" 
                  alt="Vedanta Logo" 
                  className="h-7 sm:h-8 w-auto mr-2 flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                <div className="flex items-center" style={{ display: 'none' }}>
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 mr-2" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-white">VEDANTA</span>
              </div>
              <p className="text-gray-300 text-xs sm:text-sm mb-2 leading-relaxed">
                Modern Learning. Ancient Wisdom.
              </p>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                Bridging technology and education for meaningful learning experiences.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Platform</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-300">
                <li><Link to="/courses" className="hover:text-white transition-colors touch-manipulation block py-1">Courses</Link></li>
                <li><Link to="/catalog" className="hover:text-white transition-colors touch-manipulation block py-1">Course Catalog</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors touch-manipulation block py-1">Dashboard</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Resources</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-300">
                <li><Link to="/dashboard" className="hover:text-white transition-colors touch-manipulation block py-1">Help Center</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors touch-manipulation block py-1">Documentation</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Account</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-300">
                <li><Link to="/login" className="hover:text-white transition-colors touch-manipulation block py-1">Sign In</Link></li>
                <li><Link to="/signup" className="hover:text-white transition-colors touch-manipulation block py-1">Create Account</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center">
            <p className="text-gray-300 text-xs sm:text-sm">
              © {new Date().getFullYear()} Vedanta. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
