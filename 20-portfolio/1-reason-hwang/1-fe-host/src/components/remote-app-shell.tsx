import { MobileNav } from "@/components/mobile-nav";
import { RemoteMount } from "@/components/remote-mount";
import type { RemoteName } from "@/lib/remotes";

type RemoteAppShellProps = {
  description: string;
  name: RemoteName;
  title: string;
};

export function RemoteAppShell({
  description,
  name,
  title,
}: RemoteAppShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <MobileNav />
      <header className="border-b pb-5">
        <p className="text-sm font-medium text-muted-foreground">Remote app</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </header>

      <RemoteMount name={name} />
    </div>
  );
}
