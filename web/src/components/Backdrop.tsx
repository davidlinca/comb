// Pagina produsului, estompată sub sheet, când nu avem catalogul încărcat (ex. după refresh).
export default function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 flex flex-col gap-4 bg-paper px-5 pt-14">
      <span className="text-[22px] font-extrabold tracking-tight">telvia</span>
      <div className="grid h-64 place-items-center rounded-3xl bg-mist">
        <div className="h-52 w-26 rounded-3xl border-[6px] border-ink bg-[#2a2a2a]" />
      </div>
    </div>
  );
}
