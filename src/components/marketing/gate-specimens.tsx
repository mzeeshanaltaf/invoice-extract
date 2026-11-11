import { Stamp } from "@/components/brand/stamp";

/** A lunch menu, set like a real one. The prices are why it is a fair thing to check. */
export function LunchMenuSheet() {
  const items = [
    ["Leek and potato soup", "5.50"],
    ["Halloumi flatbread", "8.00"],
    ["Pie of the day, peas", "9.50"],
    ["Flat white", "3.20"],
  ];
  return (
    <figure className="relative">
      <div className="paper-sheet text-foreground relative rotate-[-1.5deg] rounded-[3px] border border-border/60 px-7 pt-7 pb-14">
        <p className="eyebrow">The Wharf Kitchen</p>
        <p className="font-display mt-1 text-2xl leading-tight font-bold">Lunch, Tuesday to Friday</p>
        <ul className="mt-5 space-y-2.5 text-sm">
          {items.map(([name, price]) => (
            <li key={name} className="flex items-baseline gap-2">
              <span>{name}</span>
              <span aria-hidden="true" className="border-border mb-1 flex-1 border-b border-dotted" />
              <span className="figures">{price}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-5 text-xs">Service not included. Cards accepted.</p>
        <Stamp
          size="md"
          rotate={-9}
          className="absolute right-5 bottom-6"
        >
          Not an invoice
        </Stamp>
      </div>
      <figcaption className="mt-4 text-sm font-medium">
        Lunch menu: rejected, 0 credits
      </figcaption>
    </figure>
  );
}

/** A holiday print, drawn in SVG. Looks nothing like an invoice, which is the point. */
export function HolidayPhotoSheet() {
  return (
    <figure className="relative md:mt-10">
      <div className="paper-sheet relative rotate-[1.8deg] rounded-[3px] border border-border/60 p-3 pb-12">
        <svg
          viewBox="0 0 320 220"
          role="img"
          aria-label="A holiday photo: a sunny bay with a small sailing boat."
          className="block w-full rounded-[1px]"
        >
          <rect width="320" height="220" fill="oklch(0.86 0.06 235)" />
          <rect width="320" height="90" fill="oklch(0.9 0.05 235)" />
          <circle cx="238" cy="62" r="26" fill="oklch(0.92 0.13 88)" />
          <path d="M0 118 C60 92 110 108 170 96 C230 84 280 104 320 90 V150 H0 Z" fill="oklch(0.62 0.09 160)" />
          <rect y="140" width="320" height="80" fill="oklch(0.58 0.1 232)" />
          <path d="M0 160 C40 154 60 166 100 160 S180 154 220 162 S290 156 320 160" stroke="oklch(0.78 0.07 232)" strokeWidth="2" fill="none" />
          <path d="M0 184 C50 178 70 190 120 184 S210 178 260 186 S300 182 320 184" stroke="oklch(0.74 0.07 232)" strokeWidth="2" fill="none" />
          <path d="M120 158 H176 L168 170 H128 Z" fill="oklch(0.38 0.05 262)" />
          <path d="M148 120 V158 M148 124 L172 154 H148 Z" stroke="oklch(0.38 0.05 262)" strokeWidth="2" fill="oklch(0.97 0.01 88)" />
          <path d="M146 130 L126 154 H146 Z" fill="oklch(0.93 0.03 88)" stroke="oklch(0.38 0.05 262)" strokeWidth="1.5" />
        </svg>
        <p className="font-display text-muted-foreground mt-3 text-sm italic">Lisbon, August</p>
        <Stamp
          size="md"
          rotate={-8}
          className="absolute right-4 bottom-4"
        >
          Not an invoice
        </Stamp>
      </div>
      <figcaption className="mt-4 text-sm font-medium">
        Holiday photo: rejected, 0 credits
      </figcaption>
    </figure>
  );
}
