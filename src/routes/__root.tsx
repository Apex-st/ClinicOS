import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/app-shell";
import { applyBootGreeting } from "@/lib/boot-greeting";
import { useClinic } from "@/lib/store";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Дента";

const BOOT_GREETING = `(function(){try{function tg(){var h=new Date().getHours();if(h<12)return"Доброе утро";if(h<18)return"Добрый день";return"Добрый вечер"}function fn(d){return[d.lastName,d.firstName,d.middleName].filter(Boolean).join(" ")}var greeting=tg();try{var clinic=JSON.parse(localStorage.getItem("denta-clinic-v1")||"{}");var st=clinic.state||clinic;var settings=st.settings||{};var doctors=st.doctors||[];var session={};try{session=JSON.parse(sessionStorage.getItem("denta-session-v1")||"{}")}catch(e){}var sid=session.doctorId;function byId(id){if(!id)return;for(var i=0;i<doctors.length;i++)if(doctors[i].id===id)return doctors[i]}var chosen=byId(settings.welcomeDoctorId)||byId(sid)||doctors.filter(function(d){return d.active!==false})[0]||doctors[0];var fio=chosen?fn(chosen):(settings.doctorName||"").trim();var custom=(settings.welcomeText||"").trim();if(settings.welcomeMode==="custom"&&custom){if(custom.indexOf("{фио}")>=0)greeting=custom.split("{фио}").join(fio);else if(custom.indexOf("{имя}")>=0)greeting=custom.split("{имя}").join(fio);else greeting=fio?custom+", "+fio:custom}else greeting=fio?tg()+", "+fio:tg()}catch(e){}var el=document.getElementById("denta-boot-text");if(el)el.textContent=greeting}catch(e){}})();`;

function BootScreen() {
  useLayoutEffect(() => {
    applyBootGreeting();
    return useClinic.persist.onFinishHydration(() => applyBootGreeting());
  }, []);
  return (
    <div id="denta-boot" aria-hidden="true">
      <p id="denta-boot-text" suppressHydrationWarning>
        Дента
      </p>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#1F5C52" },
      { name: "description", content: "Кабинет врача-стоматолога: запись, пациенты, формула, касса." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="ru" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("denta-theme")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=d?"dark":"light";document.documentElement.setAttribute("data-theme",r);document.documentElement.style.colorScheme=r;}catch(e){}})();`,
          }}
        />
        <BootScreen />
        <script dangerouslySetInnerHTML={{ __html: BOOT_GREETING }} />
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster
            position="top-center"
            theme="system"
            toastOptions={{
              className: "font-sans",
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
