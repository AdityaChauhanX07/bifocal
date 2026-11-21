type Person = {
  name?: string;
  email?: string;
  phone?: string;
};

export type RedactionOptions = {
  profile?: Person;
  trustedContact?: Pick<Person, "name" | "email">;
  senderEmail?: string;
};

const emailAddresses = /(?<![\p{L}\p{N}.!#$%&'*+/=?^_{}|~-])[\p{L}\p{N}.!#$%&'*+/=?^_{}|~-]+@(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,63}/giu;
const webLink = /(?:https?:\/\/|www\.)[^\s<>"]+/;
const bareLink = /(?<![\p{L}\p{N}_.@-])(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}(?::\d{1,5})?[/?#][^\s<>"]*/u;
const linksAndMail = new RegExp(
  "(?<link>" + webLink.source + "|" + bareLink.source + ")|(?<mail>" + emailAddresses.source + ")",
  "giu",
);
const street = new RegExp(
  [
    /(?<![$€£\p{L}\p{N}])\d{1,6}(?:-\d{1,6})?[ \t]+/u,
    /(?:(?:[\p{L}][\p{L}\p{N}.'’-]*|\d+(?:st|nd|rd|th))[ \t]+){1,6}?/u,
    /(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|place|pl|circle|cir|terrace|ter|parkway|pkwy|way|highway|hwy|trail|trl)\b\.?/,
    /(?:[ \t]*,?[ \t]*(?:apt\.?|unit|suite|ste\.?|#)[ \t]*[a-z\d-]+)?/,
    /(?:[ \t]*,[ \t]*[\p{L}][\p{L} .'-]*,[ \t]*[a-z]{2}[ \t]+\d{5}(?:-\d{4})?)?/u,
  ].map((part) => part.source).join(""),
  "giu",
);
const code = new RegExp(
  [
    /\b((?:(?:one[- ]time|verification|security|login|sign[- ]in)[ \t]+(?:code|passcode)|code|passcode|OTP|PIN)(?:[ \t]+is)?[ \t]*(?:[:=#]\s*|[ \t]+))/,
    /(\d{3}[-\u2010-\u2014 ]\d{3}|\d{4}[-\u2010-\u2014 ]\d{4}|[a-z\d]{3,4}-[a-z\d]{3,4}|[a-z\d]{4,10})/,
    /(?![\p{L}\p{N}-])/u,
  ].map((part) => part.source).join(""),
  "giu",
);
const labelledAccount = /\b((?:account|acct\.?|routing)(?:[ \t]+(?:number|no\.?))?[ \t]*[:#]\s*)([a-z\d]+(?:-[a-z\d]+)*)(?![\p{L}\p{N}_-])/giu;
const numeric = /(?<![\p{L}\p{N}_])(?:\d{1,3}(?:,\d{3})+(?:\.\d{2})?|(?:\+?\d|\(\d{1,4}\))(?:[ \t\u00a0\u202f().\u2010-\u2014\u2212-]*\d)+)(?![\p{L}\p{N}_])/gu;
const northAmericanPhone = /^(?:\+?1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-]?)\d{3}[ .-]?\d{4}$/;
const callContext = /\b(?:call|text|contact|dial|ring|phone|reach)\b[^.!?;0-9]{0,48}$/i;

function digitsOnly(formatted: string) {
  return formatted.replace(/\D/g, "");
}

function phoneDigits(formatted: string) {
  const digits = digitsOnly(formatted.replace(/^00/, ""));
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function isCard(digits: string) {
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if ((digits.length - 1 - index) % 2) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function nameForms(name?: string) {
  const full = name?.trim();
  if (!full || full.length < 2) return [];
  const [first] = full.split(/\s+/);
  return first.length > 1 && first !== full ? [full, first] : [full];
}

function namePattern(name: string) {
  const words = name.split(/\s+/).map((word) => word.replace(/[$(){}.*+?^|[\]\\]/g, "\\$&"));
  return new RegExp("(?<![\\p{L}\\p{N}_])" + words.join("\\s+") + "(?![\\p{L}\\p{N}_])", "giu");
}

function redactLink(match: string, redact: (value: string) => string) {
  const tail = match.match(/[.,;:!?)]*$/)?.[0] ?? "";
  const link = tail ? match.slice(0, -tail.length) : match;
  const hasScheme = /^https?:\/\//i.test(link);
  let url: URL;
  try {
    url = new URL(hasScheme ? link : "https://" + link);
  } catch {
    return "[LINK]" + tail;
  }

  if (redact(url.hostname) !== url.hostname) return "[LINK]" + tail;
  const path = url.pathname
    .split("/")
    .map((part) => {
      let decoded: string;
      try {
        decoded = decodeURIComponent(part);
        if (/%[0-9a-f]{2}/i.test(decoded)) decoded = decodeURIComponent(decoded);
        if (/%[0-9a-f]{2}/i.test(decoded)) return "%5BLINK_PART%5D";
      } catch {
        return "%5BLINK_PART%5D";
      }
      const safe = redact(decoded);
      return safe === decoded ? part : encodeURIComponent(safe);
    })
    .join("/");
  const origin = hasScheme ? url.origin : url.host;
  return origin + (path === "/" ? "" : path) + tail;
}

export function redactText(message: string, options: RedactionOptions = {}) {
  const myEmail = options.profile?.email?.trim().toLowerCase();
  const contactEmail = options.trustedContact?.email?.trim().toLowerCase();
  const sender = options.senderEmail?.trim().toLowerCase();
  const myPhone = phoneDigits(options.profile?.phone ?? "");
  const names = [
    ...nameForms(options.profile?.name).map((name) => ({ name, tag: "[MY_NAME]" })),
    ...nameForms(options.trustedContact?.name).map((name) => ({ name, tag: "[CONTACT_NAME]" })),
  ]
    .sort((first, second) => second.name.length - first.name.length)
    .map(({ name, tag }) => ({ pattern: namePattern(name), tag }));

  function redactMailbox(mail: string) {
    const lower = mail.toLowerCase();
    if (lower === myEmail) return "[MY_EMAIL]";
    if (lower === contactEmail) return "[CONTACT_EMAIL]";
    if (lower === sender) {
      const domain = mail.slice(mail.lastIndexOf("@") + 1);
      return redactProse(domain) === domain ? "[SENDER]@" + domain : "[SENDER]";
    }
    return "[EMAIL]";
  }

  function redactProse(text: string) {
    const addresses = text.replace(street, "[ADDRESS]");
    const named = names.reduce((value, { pattern, tag }) => value.replace(pattern, tag), addresses);
    const coded = named.replace(code, (match, lead: string, value: string) =>
      /\d/.test(value) || /^[A-Z]{4,10}$/.test(value) ? lead + "[CODE]" : match,
    );

    const labelled = coded.replace(labelledAccount, (match, lead: string, value: string) =>
      /[a-z]/i.test(value) && digitsOnly(value).length >= 4 ? lead + "[ACCOUNT]" : match,
    );
    return labelled.replace(numeric, (number, offset: number) => {
      const digits = digitsOnly(number);
      if (myPhone && phoneDigits(number) === myPhone) return "[MY_PHONE]";

      const formatted = number.replace(/[\u2010-\u2014\u2212]/g, "-").replace(/[\u00a0\u202f]/g, " ");
      const before = labelled.slice(Math.max(0, offset - 60), offset);
      const after = labelled.slice(offset + number.length, offset + number.length + 55);
      if (
        /^\d{3}[- ]\d{2}[- ]\d{4}$/.test(formatted) ||
        (digits.length === 9 && /\b(?:SSN|social security number)[ \t:#-]*$/i.test(before))
      ) {
        return "[SSN]";
      }
      if (isCard(digits)) return "[CARD]";
      if (
        digits.length >= 4 && digits.length <= 8 &&
        /^\s+(?:is your (?:one[- ]time |verification |security )?code|to verify\b)/i.test(after)
      ) {
        return "[CODE]";
      }
      if (
        digits.length >= 4 &&
        /\b(?:account|acct\.?|routing)(?:\s+(?:number|no\.?|ending(?:\s+in)?))?[ \t:#-]*$/i.test(before)
      ) {
        return "[ACCOUNT]";
      }
      const phone = northAmericanPhone.test(formatted) || (number.startsWith("+") && digits.length <= 15);
      if (phone && callContext.test(before)) return number;
      if (/[$€£][ \t]*$|\b(?:USD|EUR|GBP)[ \t]+$/i.test(before)) return number;
      return digits.length >= 9 ? "[ACCOUNT]" : number;
    });
  }

  const redacted: string[] = [];
  let cursor = 0;
  for (const token of message.matchAll(linksAndMail)) {
    const { link, mail } = token.groups!;
    redacted.push(redactProse(message.slice(cursor, token.index)));
    redacted.push(
      link
        ? redactLink(link, (part) => redactProse(part.replace(emailAddresses, redactMailbox)))
        : redactMailbox(mail),
    );
    cursor = token.index + token[0].length;
  }
  redacted.push(redactProse(message.slice(cursor)));
  return redacted.join("");
}
