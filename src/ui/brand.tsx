import Image from "next/image";
import Link from "next/link";
import styles from "./brand.module.css";

export function Brand({ href = "/" }: { href?: string } = {}) {
  return (
    <Link href={href} className={styles.brand}>
      <Image src="/logo.svg" width={30} height={30} alt="" />
      <span>CGT<wbr /><span>Tracker</span></span>
    </Link>
  );
}
