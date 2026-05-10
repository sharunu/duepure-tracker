"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type Scope = "personal" | "team" | "global";

type Props = {
  scope: Scope;
  setScope: (s: Scope) => void;
  teamEnabled?: boolean;
  isGuest?: boolean;
};

export function ScopeSelector({ scope, setScope, teamEnabled = false, isGuest = false }: Props) {
  return (
    <SegmentedControl<Scope>
      items={[
        { value: "personal", label: "自分のみ" },
        { value: "team", label: "Discord", disabled: !teamEnabled || isGuest },
        { value: "global", label: "全ユーザー", disabled: isGuest },
      ]}
      value={scope}
      onChange={setScope}
      size="md"
      variant="filled"
      fullWidth
    />
  );
}
