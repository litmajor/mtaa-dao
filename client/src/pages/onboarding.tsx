import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function OnboardingPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Get Started — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Get Started</h1>
      <p className="text-sm text-slate-500 mt-2">A guided setup to create or join a DAO and set up your wallet.</p>
    </div>
  );
}
