import { Brand } from "@/ui/brand";
import { PreviewNav } from "./PreviewNav";
import styles from "./preview.module.css";

export default function DesignPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.identity}>
            <Brand href="/design-preview" />
            <span>Design preview</span>
          </div>
          <PreviewNav />
        </div>
      </header>
      {children}
    </div>
  );
}
