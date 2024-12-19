import React, { PropsWithChildren } from "react";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

// Generic Error Fallback UI
const ErrorFallback: React.FC<{ error: unknown }> = ({ error }) => {
    const errorMessage =
        error instanceof Error
            ? error.message
            : isRouteErrorResponse(error)
                ? error.statusText
                : "An unknown error occurred.";

    const errorDetails =
        error instanceof Error
            ? error.stack || "No stack trace available."
            : JSON.stringify(error, null, 2);

    const handleReload = () => {
        localStorage.clear(); // Clear local storage
        window.location.reload(); // Reload the page
    };
    return (
        <div className="flex flex-col items-center justify-center h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">Upsík dupsík. Něco se nepovedlo. :-)</h1>
            <p className="mb-4 text-gray-600">{errorMessage}</p>
            <button
                onClick={handleReload}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
                Clear Local Storage & Reload
            </button>
            <Accordion type="single" collapsible className="p-8 max-w-full">
                <AccordionItem value="error-details">
                    <AccordionTrigger>Error Details</AccordionTrigger>
                    <AccordionContent>
                        <div className="p-4 rounded text-sm overflow-auto">
                            <pre>
                                {errorDetails}
                            </pre>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

// React Error Boundary for render errors
export const RenderErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <ReactErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error, info) => {
          console.error("Error caught by ErrorBoundary:", error, info);
        }}
      >
        {children}
      </ReactErrorBoundary>
    );
  };

export const RouteErrorBoundary = ({ children }: PropsWithChildren) => {
    const routeError = useRouteError();
    return <ErrorFallback error={routeError} />;
};
