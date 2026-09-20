import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "companies" })
export class Company {
  // SEC 회사 고유 식별자(CIK). 10자리 문자열로 저장.
  @PrimaryColumn({ name: "cik", type: "varchar", length: 10 })
  cik!: string;

  // 거래소 티커 심볼. 비상장/데이터 누락 시 null 가능.
  @Column({ name: "ticker", type: "varchar", length: 32, nullable: true })
  ticker!: string | null;

  // SEC 제출 원본의 회사명(정식 명칭).
  @Column({ name: "name", type: "text" })
  name!: string;

  // SIC(산업 분류 코드). 없는 회사는 null.
  @Column({ name: "sic", type: "int", nullable: true })
  sic!: number | null;

  // 레코드 마지막 갱신 시각. update 시 자동으로 갱신됨.
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
