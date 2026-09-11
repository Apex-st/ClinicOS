import { toast } from "sonner";
import { isNativeApp } from "@/lib/native-file";

type PickedContact = { name?: string[]; tel?: string[] };

function firstPhone(raw: string | null | undefined) {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}

function contactsGranted(perm: { contacts?: string } | null | undefined) {
  if (!perm) return false;
  const v = perm.contacts;
  return v === "granted" || v === "limited";
}

async function pickViaWebContacts(): Promise<string | null | "skip"> {
  const nav = navigator as Navigator & {
    contacts?: {
      select: (properties: string[], options?: { multiple?: boolean }) => Promise<PickedContact[]>;
      getProperties?: () => Promise<string[]>;
    };
  };
  if (!nav.contacts?.select) return "skip";
  try {
    const available = (await nav.contacts.getProperties?.()) ?? ["name", "tel"];
    const props = ["tel", "name"].filter((p) => available.includes(p));
    const selected = await nav.contacts.select(props.length ? props : ["tel"], { multiple: false });
    const tel = firstPhone(selected?.[0]?.tel?.[0]);
    if (tel) return tel;
    if (selected?.[0]) {
      toast.error("В этом контакте нет телефона");
      return null;
    }
    return "skip";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    return "skip";
  }
}

/** Открывает контакты телефона и возвращает номер. */
export async function pickPhoneFromDevice(): Promise<string | null> {
  const native = await isNativeApp();

  if (!native) {
    const web = await pickViaWebContacts();
    if (web !== "skip") return web;
    toast.error("На этом устройстве список контактов недоступен");
    return null;
  }

  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    let perm = await Contacts.checkPermissions();
    if (!contactsGranted(perm)) {
      perm = await Contacts.requestPermissions();
    }
    try {
      const { contact } = await Contacts.pickContact({
        projection: { name: true, phones: true },
      });
      const tel =
        firstPhone(contact.phones?.find((p) => p.isPrimary)?.number) ||
        firstPhone(contact.phones?.[0]?.number);
      if (tel) return tel;
      toast.error("В этом контакте нет телефона");
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (/cancel|dismiss|user|result.?code|ok/i.test(msg) && !/permission/i.test(msg)) return null;
      if (!contactsGranted(perm) || /permission/i.test(msg)) {
        toast.error("Нужен доступ к контактам");
        return null;
      }
      if (/cancel|dismiss|user/i.test(msg)) return null;
      toast.error("Не удалось открыть контакты");
      return null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/permission/i.test(msg)) {
      toast.error("Нужен доступ к контактам");
      return null;
    }
    toast.error("Не удалось открыть контакты");
    return null;
  }
}
