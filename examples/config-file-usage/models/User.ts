import { Schema, model } from 'mongoose'

interface IUser {
  firstName: string
  lastName?: string
}

const UserSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: false
  }
})

export default model<IUser>('user', UserSchema)
