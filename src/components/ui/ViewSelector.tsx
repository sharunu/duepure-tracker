"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type View = "stats" | "trend";

type Props = {
  view: View;
  setView: (v: View) => void;
};

export function ViewSelector({ view, setView }: Props) {
  return (
    <SegmentedControl<View>
      items={[
        { value: "stats", label: "サマリー" },
        { value: "trend", label: "推移" },
      ]}
      value={view}
      onChange={setView}
      variant="underline"
      fullWidth
    />
  );
}
