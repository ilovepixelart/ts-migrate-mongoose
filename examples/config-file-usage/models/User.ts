import { Schema, model } from 'mongoose'

interface IUser {
  firstName: string
  lastName: string
}

const UserSchema = new Schema<IUser>({
  firstName: String,
  lastName: String
})

export default model<IUser>('user', UserSchema)
