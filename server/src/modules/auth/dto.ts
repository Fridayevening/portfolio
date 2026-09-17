import { IsString, Length } from "class-validator";

export class UnlockRequest {
  @IsString()
  @Length(1, 256)
  token!: string;
}
