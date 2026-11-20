import type { ReactNode } from "react";
import styles from "./workspace-records.module.css";

export function WorkspaceMasthead({
  title,
  children,
  controls,
}: {
  title: string;
  children?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <header className={styles.masthead}>
      <div>
        <h1 id="workspace-title" tabIndex={-1}>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {controls && <div className={styles.mastheadControls}>{controls}</div>}
    </header>
  );
}
