import { Card, CardContent } from "../components/ui/card";
import { AlertCircle, Home, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>404 Page Not Found | MtaaDAO</title>
        <meta name="description" content="The page you're looking for doesn't exist. Return to MtaaDAO home or contact support." />
        <meta property="og:title" content="404 - Page Not Found" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
        <Card className="w-full max-w-md bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="h-10 w-10 text-orange-500" aria-label="Error icon" />
              <div>
                <div className="text-orange-400 text-sm font-semibold">Error 404</div>
                <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
              </div>
            </div>

            <p className="text-purple-200 text-sm mb-8 leading-relaxed">
              The page you're looking for doesn't exist or may have moved. Let's get you back on track.
            </p>

            <div className="space-y-3">
              <Link to="/" className="block">
                <Button variant="primary" className="w-full flex items-center justify-center gap-2">
                  <Home className="w-4 h-4" />
                  Back to Home
                </Button>
              </Link>
              <a href="https://t.me/mtaadao" target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2 text-white border-white/30 hover:bg-white/10">
                  <MessageSquare className="w-4 h-4" />
                  Contact Support
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
