import { AuthForm, type AuthMode } from "./auth-form";
import { CheckCircle } from "lucide-react";
export function AuthPage({
  mode,
  token,
  next,
  verificationNotice,
}: {
  mode: AuthMode;
  next?: string;
  token?: string;
  verificationNotice?: "failed" | "complete";
}) {
  return (
    <main
      id="main"
      className={mode === "sign-up" ? "classic-signup" : "classic-auth"}
    >
      <div
        className={
          mode === "sign-up"
            ? "flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24"
            : "contents"
        }
      >
        <AuthForm
          nextPath={next}
          mode={mode}
          token={token}
          verificationNotice={verificationNotice}
        />
      </div>
      {mode === "sign-up" && (
        <aside className="hidden lg:block relative w-0 flex-1 bg-slate-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px]" />
          <div className="absolute inset-0 flex flex-col justify-center px-16 text-white z-10">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl max-w-lg">
              <h2 className="text-2xl font-bold mb-6 tracking-tight">
                Less time in spreadsheets.
              </h2>
              <p className="text-blue-100 text-lg leading-relaxed">
                Bring your trading history together, review every import and
                follow the matching behind each gain. Start with the qualified
                broker formats in our relaunch preview.
              </p>
            </div>
            <div className="mt-16 space-y-4">
              {[
                "Traceable share matching",
                "Automatic Section 104 pooling",
                "Historical loss scenarios",
              ].map((text) => (
                <p className="flex items-center gap-3" key={text}>
                  <CheckCircle
                    className="text-green-400 w-6 h-6"
                    aria-hidden="true"
                  />
                  <span className="text-lg font-medium">{text}</span>
                </p>
              ))}
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
