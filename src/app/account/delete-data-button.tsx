"use client";

import { deleteAccountDataAction } from "@/lib/account/actions";

// Confirms before invoking the erasure server action (which redirects).
export function DeleteDataButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (
          confirm(
            "Delete your account and personal data? This removes your name, phone, and dining history and can't be undone.",
          )
        ) {
          void deleteAccountDataAction();
        }
      }}
      className="text-sm font-medium text-red-600 hover:text-red-700"
    >
      Delete my data
    </button>
  );
}
