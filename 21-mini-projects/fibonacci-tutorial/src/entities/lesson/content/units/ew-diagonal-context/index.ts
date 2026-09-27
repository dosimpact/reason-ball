import { theory } from "../../../factory";

export const lesson = theory(["ew-diagonal-context","Diagonal은 별도 패턴","Diagonal의 1·4파 겹침은 일반 Impulse의 예외 적용 범위가 다르다.","Leading은 1파 또는 A, Ending은 5파 또는 C 말단에 놓이는지 먼저 확인한다.","말단 5파의 쐐기형 경계와 겹침이 함께 있으면 Ending 후보를 검토한다.","겹침 하나만으로 모든 일반 Impulse 오류를 Diagonal로 바꿀 수 없다.","위치·경계·내부 분할을 묶어 별도 정책으로 판정한다.","Diagonal의 겹침 허용을 일반 Impulse에 그대로 적용할 수 있는가?","T"], "ew-diagonals");
