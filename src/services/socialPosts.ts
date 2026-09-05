import pb from '@/lib/pocketbase/client'
import type {
  SocialPost,
  SocialPostFormat,
  SocialPostPlatform,
  SocialPostStatus,
} from '@/types/inventory'

export interface CreateSocialPostInput {
  product_id: string
  status?: SocialPostStatus
  format?: SocialPostFormat
  platform?: SocialPostPlatform
  caption?: string
  posted_at?: string
  notes?: string
}

export interface UpdateSocialPostInput {
  status?: SocialPostStatus
  format?: SocialPostFormat
  platform?: SocialPostPlatform
  caption?: string
  posted_at?: string
  notes?: string
}

export const socialPostsService = {
  async getAll(filter?: string): Promise<SocialPost[]> {
    return await pb.collection('social_posts').getFullList<SocialPost>({
      filter: filter || '',
      sort: '-created',
      expand: 'product_id',
    })
  },

  async getOne(id: string): Promise<SocialPost> {
    return await pb.collection('social_posts').getOne<SocialPost>(id, {
      expand: 'product_id',
    })
  },

  async create(data: CreateSocialPostInput): Promise<SocialPost> {
    return await pb.collection('social_posts').create<SocialPost>(
      {
        status: data.status || 'Pendente',
        ...data,
      },
      {
        expand: 'product_id',
      },
    )
  },

  async update(id: string, data: UpdateSocialPostInput): Promise<SocialPost> {
    return await pb.collection('social_posts').update<SocialPost>(id, data, {
      expand: 'product_id',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('social_posts').delete(id)
  },

  async markAsPosted(id: string): Promise<SocialPost> {
    return await pb.collection('social_posts').update<SocialPost>(
      id,
      {
        status: 'Postado',
        posted_at: new Date().toISOString(),
      },
      {
        expand: 'product_id',
      },
    )
  },

  async markAsPending(id: string): Promise<SocialPost> {
    return await pb.collection('social_posts').update<SocialPost>(
      id,
      {
        status: 'Pendente',
        posted_at: '',
      },
      {
        expand: 'product_id',
      },
    )
  },
}
